import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service.js';

import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    // 1. Find the user in PostgreSQL
    const user = await this.prisma.user.findUnique({
      where: {
        username: loginDto.username,
      },

      include: {
        role: true,
        company: true,
      },
    });

    // 2. Reject missing or inactive accounts
    if (
      !user ||
      !user.isActive ||
      !user.role.isActive ||
      !user.company.isActive
    ) {
      throw new UnauthorizedException(
        'Invalid username or password',
      );
    }

    // 3. Compare the entered password
    // with the stored bcrypt password hash
    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    // 4. Reject incorrect passwords
    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Invalid username or password',
      );
    }

    // 5. Create the JWT payload
    const payload = {
      sub: user.id,
      username: user.username,
    };

    // 6. Generate the signed access token
    const accessToken =
      await this.jwtService.signAsync(payload);

    // 7. Return the token and safe user information
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 900,

      user: {
        id: user.id,
        username: user.username,
        email: user.email,

        role: user.role.name,

        company: {
          id: user.company.id,
          name: user.company.name,
        },
      },
    };
  }
}
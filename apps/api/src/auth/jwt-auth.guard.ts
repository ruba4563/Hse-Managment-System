import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../prisma/prisma.service.js';

import type {
  AuthenticatedRequest,
  AuthenticatedUser,
  JwtPayload,
} from './auth.types.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {

    // 1. Get the incoming HTTP request
    const request =
      context.switchToHttp()
        .getRequest<AuthenticatedRequest>();

    // 2. Extract the Bearer token
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException(
        'Authentication required',
      );
    }

    // 3. Verify the JWT
    let payload: JwtPayload;

    try {
      payload =
        await this.jwtService.verifyAsync<JwtPayload>(
          token,
          {
            issuer: 'hse-api',
            audience: 'hse-web',
          },
        );
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired access token',
      );
    }

    // 4. Validate the expected payload
    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.username !== 'string'
    ) {
      throw new UnauthorizedException(
        'Invalid access token',
      );
    }

    // 5. Retrieve the current user from PostgreSQL
    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },

      include: {
        role: true,
        company: true,
      },
    });

    // 6. Check that the account is still active
    if (
      !user ||
      !user.isActive ||
      !user.role.isActive ||
      !user.company.isActive
    ) {
      throw new UnauthorizedException(
        'Account is unavailable',
      );
    }

    // 7. Create a safe user object
    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      username: user.username,
      email: user.email,

      role: {
        id: user.role.id,
        name: user.role.name,
      },

      company: {
        id: user.company.id,
        name: user.company.name,
      },
    };

    // 8. Attach the authenticated user to the request
    request.user = authenticatedUser;

    // 9. Allow the request to continue
    return true;
  }

  private extractToken(
    request: AuthenticatedRequest,
  ): string | undefined {

    const authorization =
      request.headers.authorization;

    if (!authorization) {
      return undefined;
    }

    const match = /^Bearer ([^\s]+)$/i.exec(
      authorization,
    );

    return match?.[1];
  }
}
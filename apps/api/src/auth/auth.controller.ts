import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';

import { LoginDto } from './dto/login.dto.js';

import { JwtAuthGuard } from './jwt-auth.guard.js';

import type {
  AuthenticatedRequest,
} from './auth.types.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  // Public login endpoint
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
  ) {
    return this.authService.login(loginDto);
  }

  // Protected current-user endpoint
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      user: request.user,
    };
  }
}
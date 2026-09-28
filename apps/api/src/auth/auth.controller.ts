import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
    HttpCode,
  HttpStatus,
} from '@nestjs/common';

import {
  AuthService,
} from './auth.service.js';

import {
  JwtAuthGuard,
} from './jwt-auth.guard.js';

import type {
  AuthenticatedRequest,
} from './auth.types.js';

import {
  LoginDto,
} from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService:
      AuthService,
  ) {}

  // =====================================
  // LOGIN
  // =====================================
@Post('login')
@HttpCode(HttpStatus.OK)
login(
  @Body()
  dto: LoginDto,
) {
  return this.authService.login(
    dto,
  );
}

  // =====================================
  // CURRENT USER
  // =====================================

  @Get('me')
  @UseGuards(
    JwtAuthGuard,
  )
  me(
    @Req()
    request: AuthenticatedRequest,
  ) {
    return request.user;
  }
}
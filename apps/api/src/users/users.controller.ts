import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { UsersService } from './users.service.js';

import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto.js';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

import { PermissionsGuard } from
  '../auth/authorization/permissions.guard.js';

import { RequirePermission } from
  '../auth/authorization/require-permission.decorator.js';

import type {
  AuthenticatedRequest,
} from '../auth/auth.types.js';

@Controller('users')
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  // =====================================
  // GET /users
  // =====================================

  @Get()
  @RequirePermission(
    'users',
    'read',
  )
  findAll(
    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.usersService.findAll(
      request.user.company.id,
    );
  }

  // =====================================
  // GET /users/roles
  // =====================================

  @Get('roles')
  @RequirePermission(
    'users',
    'read',
  )
  findRoles() {
    return this.usersService.findRoles();
  }

  // =====================================
  // GET /users/available-employees
  // =====================================

  @Get('available-employees')
  @RequirePermission(
    'users',
    'read',
  )
  findAvailableEmployees(
    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.usersService.findAvailableEmployees(
      request.user.company.id,
    );
  }

  // =====================================
  // POST /users
  // =====================================

  @Post()
  @RequirePermission(
    'users',
    'create',
  )
  create(
    @Req()
    request: AuthenticatedRequest,

    @Body()
    dto: CreateUserDto,
  ) {
    return this.usersService.create(
      request.user.company.id,
      request.user.id,
      dto,
    );
  }

  // =====================================
  // PATCH /users/:id
  // =====================================

  @Patch(':id')
  @RequirePermission(
    'users',
    'update',
  )
  update(
    @Req()
    request: AuthenticatedRequest,

    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    targetUserId: string,

    @Body()
    dto: UpdateUserDto,
  ) {
    return this.usersService.update(
      request.user.company.id,
      request.user.id,
      targetUserId,
      dto,
    );
  }

  // =====================================
  // PATCH /users/:id/deactivate
  // =====================================

  @Patch(':id/deactivate')
  @RequirePermission(
    'users',
    'deactivate',
  )
  deactivate(
    @Req()
    request: AuthenticatedRequest,

    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    targetUserId: string,
  ) {
    return this.usersService.deactivate(
      request.user.company.id,
      request.user.id,
      targetUserId,
    );
  }

  // =====================================
  // PATCH /users/:id/activate
  // =====================================

  @Patch(':id/activate')
  @RequirePermission(
    'users',
    'activate',
  )
  activate(
    @Req()
    request: AuthenticatedRequest,

    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    targetUserId: string,
  ) {
    return this.usersService.activate(
      request.user.company.id,
      request.user.id,
      targetUserId,
    );
  }

  // =====================================
  // POST /users/:id/reset-password
  // =====================================

  @Post(':id/reset-password')
  @RequirePermission(
    'users',
    'reset-password',
  )
  resetPassword(
    @Req()
    request: AuthenticatedRequest,

    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    targetUserId: string,

    @Body()
    dto: ResetUserPasswordDto,
  ) {
    return this.usersService.resetPassword(
      request.user.company.id,
      request.user.id,
      targetUserId,
      dto,
    );
  }
}
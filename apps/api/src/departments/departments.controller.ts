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

import { DepartmentsService } from './departments.service.js';

import { CreateDepartmentDto } from './dto/create-department.dto.js';

import { UpdateDepartmentDto } from './dto/update-department.dto.js';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

import { PermissionsGuard } from
  '../auth/authorization/permissions.guard.js';

import { RequirePermission } from
  '../auth/authorization/require-permission.decorator.js';

import type {
  AuthenticatedRequest,
} from '../auth/auth.types.js';

@Controller('departments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DepartmentsController {
  constructor(
    private readonly departmentsService: DepartmentsService,
  ) {}

  // -------------------------------------
  // GET /departments
  // -------------------------------------

  @Get()
  @RequirePermission('departments', 'read')
  findAll(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.departmentsService.findAll(
      request.user.company.id,
    );
  }

  // -------------------------------------
  // POST /departments
  // -------------------------------------

  @Post()
  @RequirePermission('departments', 'create')
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.departmentsService.create(
      request.user.company.id,
      request.user.id,
      dto,
    );
  }

  // -------------------------------------
  // PATCH /departments/:id
  // -------------------------------------

  @Patch(':id')
  @RequirePermission('departments', 'update')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    departmentId: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(
      request.user.company.id,
      request.user.id,
      departmentId,
      dto,
    );
  }

  // -------------------------------------
  // PATCH /departments/:id/deactivate
  // -------------------------------------

  @Patch(':id/deactivate')
  @RequirePermission('departments', 'deactivate')
  deactivate(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    departmentId: string,
  ) {
    return this.departmentsService.deactivate(
      request.user.company.id,
      request.user.id,
      departmentId,
    );
  }
}
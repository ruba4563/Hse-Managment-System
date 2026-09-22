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

import { EmployeesService } from './employees.service.js';

import { CreateEmployeeDto } from './dto/create-employee.dto.js';

import { UpdateEmployeeDto } from './dto/update-employee.dto.js';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

import { PermissionsGuard } from
  '../auth/authorization/permissions.guard.js';

import { RequirePermission } from
  '../auth/authorization/require-permission.decorator.js';

import type {
  AuthenticatedRequest,
} from '../auth/auth.types.js';

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
  ) {}

  // GET /employees

  @Get()
  @RequirePermission('employees', 'read')
  findAll(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.employeesService.findAll(
      request.user.company.id,
    );
  }

  // POST /employees

  @Post()
  @RequirePermission('employees', 'create')
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(
      request.user.company.id,
      request.user.id,
      dto,
    );
  }

  // PATCH /employees/:id

  @Patch(':id')
  @RequirePermission('employees', 'update')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    employeeId: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(
      request.user.company.id,
      request.user.id,
      employeeId,
      dto,
    );
  }

  // PATCH /employees/:id/deactivate

  @Patch(':id/deactivate')
  @RequirePermission('employees', 'deactivate')
  deactivate(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    employeeId: string,
  ) {
    return this.employeesService.deactivate(
      request.user.company.id,
      request.user.id,
      employeeId,
    );
  }
}
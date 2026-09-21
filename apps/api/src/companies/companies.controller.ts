import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';

import { CompaniesService } from './companies.service.js';

import { UpdateCompanyDto } from './dto/update-company.dto.js';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

import { PermissionsGuard } from
  '../auth/authorization/permissions.guard.js';

import { RequirePermission } from
  '../auth/authorization/require-permission.decorator.js';

import type {
  AuthenticatedRequest,
} from '../auth/auth.types.js';

@Controller('companies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
  ) {}

  // -----------------------------------
  // View the current company
  // -----------------------------------

  @Get('me')
  @RequirePermission('companies', 'read')
  getMyCompany(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.companiesService.getMyCompany(
      request.user.company.id,
    );
  }

  // -----------------------------------
  // Update the current company
  // -----------------------------------

  @Patch('me')
  @RequirePermission('companies', 'update')
  updateMyCompany(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.updateMyCompany(
      request.user.company.id,
      request.user.id,
      dto,
    );
  }
}
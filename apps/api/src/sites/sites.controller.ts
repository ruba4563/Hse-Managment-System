import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { SitesService } from './sites.service.js';

import { CreateSiteDto } from './dto/create-site.dto.js';

import { UpdateSiteDto } from './dto/update-site.dto.js';

import { AssignSiteUserDto } from './dto/assign-site-user.dto.js';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

import { PermissionsGuard } from
  '../auth/authorization/permissions.guard.js';

import { RequirePermission } from
  '../auth/authorization/require-permission.decorator.js';

import type {
  AuthenticatedRequest,
} from '../auth/auth.types.js';

@Controller('sites')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SitesController {
  constructor(
    private readonly sitesService: SitesService,
  ) {}

  @Get()
  @RequirePermission('sites', 'read')
  findAll(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sitesService.findAll(
      request.user.company.id,
      request.user.id,
      request.user.role.name,
    );
  }

  @Post()
  @RequirePermission('sites', 'create')
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateSiteDto,
  ) {
    return this.sitesService.create(
      request.user.company.id,
      request.user.id,
      dto,
    );
  }

  @Patch(':id')
  @RequirePermission('sites', 'update')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    siteId: string,
    @Body() dto: UpdateSiteDto,
  ) {
    return this.sitesService.update(
      request.user.company.id,
      request.user.id,
      siteId,
      dto,
    );
  }

  @Patch(':id/deactivate')
  @RequirePermission('sites', 'deactivate')
  deactivate(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    siteId: string,
  ) {
    return this.sitesService.deactivate(
      request.user.company.id,
      request.user.id,
      siteId,
    );
  }

  @Get(':id/access')
  @RequirePermission('sites', 'assign')
  getAssignments(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    siteId: string,
  ) {
    return this.sitesService.getAssignments(
      request.user.company.id,
      siteId,
    );
  }

  @Post(':id/access')
  @RequirePermission('sites', 'assign')
  assignUser(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    siteId: string,
    @Body() dto: AssignSiteUserDto,
  ) {
    return this.sitesService.assignUser(
      request.user.company.id,
      request.user.id,
      siteId,
      dto.userId,
    );
  }

  @Delete(':id/access/:userId')
  @RequirePermission('sites', 'assign')
  removeAssignment(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    siteId: string,
    @Param('userId', new ParseUUIDPipe({ version: '4' }))
    targetUserId: string,
  ) {
    return this.sitesService.removeAssignment(
      request.user.company.id,
      request.user.id,
      siteId,
      targetUserId,
    );
  }
}
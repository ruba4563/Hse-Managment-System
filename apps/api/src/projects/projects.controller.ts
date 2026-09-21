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

import { ProjectsService } from './projects.service.js';

import { CreateProjectDto } from './dto/create-project.dto.js';

import { UpdateProjectDto } from './dto/update-project.dto.js';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

import { PermissionsGuard } from
  '../auth/authorization/permissions.guard.js';

import { RequirePermission } from
  '../auth/authorization/require-permission.decorator.js';

import type {
  AuthenticatedRequest,
} from '../auth/auth.types.js';

@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
  ) {}

  // =====================================
  // GET /projects
  // =====================================

  @Get()
  @RequirePermission('projects', 'read')
  findAll(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.projectsService.findAll(
      request.user.company.id,
    );
  }

  // =====================================
  // POST /projects
  // =====================================

  @Post()
  @RequirePermission('projects', 'create')
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(
      request.user.company.id,
      request.user.id,
      dto,
    );
  }

  // =====================================
  // PATCH /projects/:id
  // =====================================

  @Patch(':id')
  @RequirePermission('projects', 'update')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(
      request.user.company.id,
      request.user.id,
      projectId,
      dto,
    );
  }

  // =====================================
  // PATCH /projects/:id/deactivate
  // =====================================

  @Patch(':id/deactivate')
  @RequirePermission('projects', 'deactivate')
  deactivate(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return this.projectsService.deactivate(
      request.user.company.id,
      request.user.id,
      projectId,
    );
  }
}
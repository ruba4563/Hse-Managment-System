import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import type {
  AuthenticatedRequest,
} from '../auth/auth.types.js';

import {
  JwtAuthGuard,
} from '../auth/jwt-auth.guard.js';

import {
  PermissionsGuard,
} from '../auth/authorization/permissions.guard.js';

import {
  RequirePermission,
} from '../auth/authorization/require-permission.decorator.js';

import {
  ApprovePermitDto,
} from './dto/approve-permit.dto.js';

import {
  CreatePermitChecklistItemDto,
} from './dto/create-permit-checklist-item.dto.js';

import {
  CreatePermitDto,
} from './dto/create-permit.dto.js';

import {
  RejectPermitDto,
} from './dto/reject-permit.dto.js';

import {
  UpdatePermitChecklistItemDto,
} from './dto/update-permit-checklist-item.dto.js';

import {
  UpdatePermitDto,
} from './dto/update-permit.dto.js';

import {
  PermitsService,
} from './permits.service.js';

@Controller('permits')
@UseGuards(
  JwtAuthGuard,
  PermissionsGuard,
)
export class PermitsController {
  constructor(
    private readonly permitsService:
      PermitsService,
  ) {}

  // ===================================================
  // PERMIT TYPES
  // ===================================================

  @Get('types')
  @RequirePermission(
    'permits',
    'read',
  )
  findPermitTypes() {
    return this.permitsService
      .findPermitTypes();
  }

  // ===================================================
  // LIST
  // ===================================================

  @Get()
  @RequirePermission(
    'permits',
    'read',
  )
  findAll(
    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.permitsService.findAll(
      request.user.company.id,
      request.user.id,
      request.user.role.name,
    );
  }

  // ===================================================
  // CHECKLIST
  // ===================================================

  @Get(':id/checklist')
  @RequirePermission(
    'permits',
    'read',
  )
  getChecklist(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    permitId: string,

    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.permitsService.getChecklist(
      permitId,
      request.user.company.id,
      request.user.id,
      request.user.role.name,
    );
  }

  @Post(':id/checklist')
  @RequirePermission(
    'permits',
    'update',
  )
  createChecklistItem(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    permitId: string,

    @Body()
    dto: CreatePermitChecklistItemDto,

    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.permitsService.createChecklistItem(
      permitId,
      request.user.company.id,
      request.user.id,
      request.user.role.name,
      dto,
      request.ip,
    );
  }

  @Patch(':id/checklist/:itemId')
  @RequirePermission(
    'permits',
    'update',
  )
  updateChecklistItem(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    permitId: string,

    @Param(
      'itemId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    itemId: string,

    @Body()
    dto: UpdatePermitChecklistItemDto,

    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.permitsService.updateChecklistItem(
      permitId,
      itemId,
      request.user.company.id,
      request.user.id,
      request.user.role.name,
      dto,
      request.ip,
    );
  }

  @Delete(':id/checklist/:itemId')
  @RequirePermission(
    'permits',
    'update',
  )
  removeChecklistItem(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    permitId: string,

    @Param(
      'itemId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    itemId: string,

    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.permitsService.removeChecklistItem(
      permitId,
      itemId,
      request.user.company.id,
      request.user.id,
      request.user.role.name,
      request.ip,
    );
  }

  // ===================================================
  // APPROVAL HISTORY
  // ===================================================

  @Get(':id/approvals')
  @RequirePermission(
    'permits',
    'read',
  )
  getApprovals(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    permitId: string,

    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.permitsService.getApprovals(
      permitId,
      request.user.company.id,
      request.user.id,
      request.user.role.name,
    );
  }

  // ===================================================
  // GET ONE
  // ===================================================

  @Get(':id')
  @RequirePermission(
    'permits',
    'read',
  )
  findOne(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    permitId: string,

    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.permitsService.findOne(
      permitId,
      request.user.company.id,
      request.user.id,
      request.user.role.name,
    );
  }

  // ===================================================
  // CREATE
  // ===================================================

  @Post()
  @RequirePermission(
    'permits',
    'create',
  )
  create(
    @Body()
    dto: CreatePermitDto,

    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.permitsService.create(
      request.user.company.id,
      request.user.id,
      request.user.role.name,
      dto,
      request.ip,
    );
  }

  // ===================================================
  // UPDATE DRAFT
  // ===================================================

  @Patch(':id')
  @RequirePermission(
    'permits',
    'update',
  )
  update(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    permitId: string,

    @Body()
    dto: UpdatePermitDto,

    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.permitsService.update(
      permitId,
      request.user.company.id,
      request.user.id,
      request.user.role.name,
      dto,
      request.ip,
    );
  }

  // ===================================================
  // SUBMIT
  // ===================================================

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(
    'permits',
    'submit',
  )
  submit(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    permitId: string,

    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.permitsService.submit(
      permitId,
      request.user.company.id,
      request.user.id,
      request.user.role.name,
      request.ip,
    );
  }

  // ===================================================
  // APPROVE
  // ===================================================

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(
    'permits',
    'approve',
  )
  approve(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    permitId: string,

    @Body()
    dto: ApprovePermitDto,

    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.permitsService.approve(
      permitId,
      request.user.company.id,
      request.user.id,
      request.user.role.name,
      dto.comments,
      request.ip,
    );
  }

  // ===================================================
  // REJECT
  // ===================================================

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(
    'permits',
    'reject',
  )
  reject(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    permitId: string,

    @Body()
    dto: RejectPermitDto,

    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.permitsService.reject(
      permitId,
      request.user.company.id,
      request.user.id,
      request.user.role.name,
      dto.reason,
      request.ip,
    );
  }

  // ===================================================
  // ACTIVATE
  // ===================================================

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(
    'permits',
    'activate',
  )
  activate(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    permitId: string,

    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.permitsService.activate(
      permitId,
      request.user.company.id,
      request.user.id,
      request.user.role.name,
      request.ip,
    );
  }

  // ===================================================
  // CLOSE
  // ===================================================

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(
    'permits',
    'close',
  )
  close(
    @Param(
      'id',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    permitId: string,

    @Req()
    request: AuthenticatedRequest,
  ) {
    return this.permitsService.close(
      permitId,
      request.user.company.id,
      request.user.id,
      request.user.role.name,
      request.ip,
    );
  }
}
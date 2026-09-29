import {
  Body,
  Controller,
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
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/authorization/permissions.guard.js';
import { RequirePermission } from '../auth/authorization/require-permission.decorator.js';
import { InspectionsService } from './inspections.service.js';
import { CreateInspectionDto } from './dto/create-inspection.dto.js';
import { UpdateInspectionDto } from './dto/update-inspection.dto.js';
import { CreateInspectionTypeDto } from './dto/create-inspection-type.dto.js';
import { CreateInspectionTemplateItemDto } from './dto/create-inspection-template-item.dto.js';
import { UpdateInspectionResponseDto } from './dto/update-inspection-response.dto.js';
import { CreateInspectionFindingDto } from './dto/create-inspection-finding.dto.js';
import { ReviewInspectionDto } from './dto/review-inspection.dto.js';

@Controller('inspections')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Get('types')
  @RequirePermission('inspections', 'read')
  findTypes(@Req() request: AuthenticatedRequest) {
    return this.inspectionsService.findTypes(request.user);
  }

  @Get('options')
  @RequirePermission('inspections', 'read')
  getOptions(@Req() request: AuthenticatedRequest) {
    return this.inspectionsService.getOptions(request.user);
  }

  @Post('types')
  @RequirePermission('inspections', 'manage-templates')
  createType(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateInspectionTypeDto,
  ) {
    return this.inspectionsService.createType(request.user, dto, request.ip);
  }

  @Post('types/:typeId/items')
  @RequirePermission('inspections', 'manage-templates')
  addTemplateItem(
    @Param('typeId', new ParseUUIDPipe({ version: '4' })) typeId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateInspectionTemplateItemDto,
  ) {
    return this.inspectionsService.addTemplateItem(
      typeId,
      request.user,
      dto,
      request.ip,
    );
  }

  @Patch('types/:typeId/items/:itemId')
  @RequirePermission('inspections', 'manage-templates')
  updateTemplateItem(
    @Param('typeId', new ParseUUIDPipe({ version: '4' })) typeId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateInspectionTemplateItemDto,
  ) {
    return this.inspectionsService.updateTemplateItem(
      typeId,
      itemId,
      request.user,
      dto,
      request.ip,
    );
  }

  @Post('types/:typeId/items/:itemId/retire')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inspections', 'manage-templates')
  retireTemplateItem(
    @Param('typeId', new ParseUUIDPipe({ version: '4' })) typeId: string,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inspectionsService.retireTemplateItem(
      typeId,
      itemId,
      request.user,
      request.ip,
    );
  }

  @Get()
  @RequirePermission('inspections', 'read')
  findAll(@Req() request: AuthenticatedRequest) {
    return this.inspectionsService.findAll(request.user);
  }

  @Post()
  @RequirePermission('inspections', 'create')
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateInspectionDto,
  ) {
    return this.inspectionsService.create(request.user, dto, request.ip);
  }

  @Get(':id')
  @RequirePermission('inspections', 'read')
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inspectionsService.findOne(id, request.user);
  }

  @Get(':id/history')
  @RequirePermission('inspections', 'read')
  getHistory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inspectionsService.getHistory(id, request.user);
  }

  @Patch(':id')
  @RequirePermission('inspections', 'update')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateInspectionDto,
  ) {
    return this.inspectionsService.update(id, request.user, dto, request.ip);
  }

  @Patch(':id/checklist/:responseId')
  @RequirePermission('inspections', 'update')
  respond(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('responseId', new ParseUUIDPipe({ version: '4' }))
    responseId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateInspectionResponseDto,
  ) {
    return this.inspectionsService.respond(
      id,
      responseId,
      request.user,
      dto,
      request.ip,
    );
  }

  @Post(':id/findings')
  @RequirePermission('inspections', 'manage-findings')
  createFinding(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateInspectionFindingDto,
  ) {
    return this.inspectionsService.createFinding(
      id,
      request.user,
      dto,
      request.ip,
    );
  }

  @Post(':id/findings/:findingId/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inspections', 'close')
  closeFinding(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('findingId', new ParseUUIDPipe({ version: '4' })) findingId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReviewInspectionDto,
  ) {
    return this.inspectionsService.closeFinding(
      id,
      findingId,
      request.user,
      dto.comments,
      request.ip,
    );
  }

  @Post(':id/schedule')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inspections', 'update')
  schedule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inspectionsService.transition(
      id,
      request.user,
      'schedule',
      undefined,
      request.ip,
    );
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inspections', 'update')
  start(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inspectionsService.transition(
      id,
      request.user,
      'start',
      undefined,
      request.ip,
    );
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inspections', 'submit')
  submit(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inspectionsService.transition(
      id,
      request.user,
      'submit',
      undefined,
      request.ip,
    );
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inspections', 'approve')
  approve(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReviewInspectionDto,
  ) {
    return this.inspectionsService.transition(
      id,
      request.user,
      'approve',
      dto.comments,
      request.ip,
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inspections', 'approve')
  reject(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReviewInspectionDto,
  ) {
    return this.inspectionsService.transition(
      id,
      request.user,
      'reject',
      dto.comments,
      request.ip,
    );
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('inspections', 'close')
  close(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inspectionsService.transition(
      id,
      request.user,
      'close',
      undefined,
      request.ip,
    );
  }
}

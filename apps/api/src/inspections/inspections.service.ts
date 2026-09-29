import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InspectionStatus, type Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateInspectionDto } from './dto/create-inspection.dto.js';
import { UpdateInspectionDto } from './dto/update-inspection.dto.js';
import { CreateInspectionTypeDto } from './dto/create-inspection-type.dto.js';
import { CreateInspectionTemplateItemDto } from './dto/create-inspection-template-item.dto.js';
import { UpdateInspectionResponseDto } from './dto/update-inspection-response.dto.js';
import { CreateInspectionFindingDto } from './dto/create-inspection-finding.dto.js';

const userSelect = { id: true, username: true } as const;
const inspectionInclude = {
  inspectionType: true,
  project: { select: { id: true, name: true } },
  site: { select: { id: true, name: true } },
  inspector: { select: userSelect },
  submittedBy: { select: userSelect },
  approvedBy: { select: userSelect },
  checklistResponses: {
    include: { templateItem: true, respondedBy: { select: userSelect } },
    orderBy: [{ templateItem: { displayOrder: 'asc' } }, { id: 'asc' }],
  },
  findings: {
    orderBy: { createdAt: 'asc' },
    include: { createdBy: { select: userSelect } },
  },
} satisfies Prisma.InspectionInclude;

@Injectable()
export class InspectionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ===================================================
  // COMPANY AND SITE SCOPE
  // ===================================================

  private scope(user: AuthenticatedUser): Prisma.InspectionWhereInput {
    return {
      project: { companyId: user.company.id },
      inspectionType: { companyId: user.company.id },
      site: {
        project: { companyId: user.company.id },
        ...(user.role.name !== 'SUPER_ADMIN' && {
          userAccess: { some: { userId: user.id } },
        }),
      },
    };
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.inspection.findMany({
      where: this.scope(user),
      include: {
        inspectionType: true,
        site: { select: { id: true, name: true } },
        inspector: { select: userSelect },
        _count: { select: { findings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const inspection = await this.prisma.inspection.findFirst({
      where: { id, ...this.scope(user) },
      include: inspectionInclude,
    });
    if (!inspection) throw new NotFoundException('Inspection not found');
    return inspection;
  }

  findTypes(user: AuthenticatedUser) {
    return this.prisma.inspectionType.findMany({
      where: { companyId: user.company.id },
      include: {
        templateItems: { orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] },
      },
      orderBy: { name: 'asc' },
    });
  }

  // Inspection forms do not require unrelated users:read or projects:read grants.
  async getOptions(user: AuthenticatedUser) {
    const sites = await this.prisma.site.findMany({
      where: {
        isActive: true,
        project: { companyId: user.company.id, isActive: true },
        ...(user.role.name !== 'SUPER_ADMIN' && {
          userAccess: { some: { userId: user.id } },
        }),
      },
      select: {
        id: true,
        name: true,
        projectId: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
    const inspectors = await this.prisma.user.findMany({
      where: {
        companyId: user.company.id,
        isActive: true,
        role: { isActive: true },
        OR: [
          { role: { name: 'SUPER_ADMIN' } },
          {
            siteAccess: {
              some: { siteId: { in: sites.map((site) => site.id) } },
            },
          },
        ],
      },
      select: {
        ...userSelect,
        role: { select: { name: true } },
        siteAccess: {
          where: { siteId: { in: sites.map((site) => site.id) } },
          select: { siteId: true },
        },
      },
      orderBy: { username: 'asc' },
    });
    return { sites, inspectors };
  }

  // ===================================================
  // TYPES AND TEMPLATES
  // ===================================================

  async createType(
    user: AuthenticatedUser,
    dto: CreateInspectionTypeDto,
    ipAddress?: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const type = await tx.inspectionType.create({
          data: {
            name: dto.name.trim(),
            code: dto.code,
            category: dto.category,
            description: dto.description,
            companyId: user.company.id,
          },
        });
        await this.audit(
          tx,
          user,
          type.id,
          'TYPE_CREATE',
          null,
          type,
          ipAddress,
        );
        return type;
      });
    } catch (error) {
      if (this.isUniqueError(error))
        throw new ConflictException(
          'Inspection type name or code already exists',
        );
      throw error;
    }
  }

  async addTemplateItem(
    typeId: string,
    user: AuthenticatedUser,
    dto: CreateInspectionTemplateItemDto,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockType(tx, typeId, user.company.id);
      const item = await tx.inspectionTemplateItem.create({
        data: {
          itemText: dto.itemText.trim(),
          sectionName: dto.sectionName,
          isMandatory: dto.isMandatory,
          displayOrder: dto.displayOrder,
          inspectionTypeId: typeId,
        },
      });
      await this.audit(
        tx,
        user,
        typeId,
        'TEMPLATE_ITEM_CREATE',
        null,
        item,
        ipAddress,
      );
      return item;
    });
  }

  async updateTemplateItem(
    typeId: string,
    itemId: string,
    user: AuthenticatedUser,
    dto: CreateInspectionTemplateItemDto,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockType(tx, typeId, user.company.id);
      const item = await tx.inspectionTemplateItem.findFirst({
        where: { id: itemId, inspectionTypeId: typeId },
      });
      if (!item) throw new NotFoundException('Template item not found');
      // Preserve the questions and mandatory flags on historical checklists.
      if (
        await tx.inspectionChecklistResponse.count({
          where: { templateItemId: itemId },
        })
      ) {
        throw new ConflictException(
          'This item has been used. Retire it and add a new item to preserve inspection history',
        );
      }
      const updated = await tx.inspectionTemplateItem.update({
        where: { id: itemId },
        data: dto,
      });
      await this.audit(
        tx,
        user,
        typeId,
        'TEMPLATE_ITEM_UPDATE',
        item,
        updated,
        ipAddress,
      );
      return updated;
    });
  }

  async retireTemplateItem(
    typeId: string,
    itemId: string,
    user: AuthenticatedUser,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockType(tx, typeId, user.company.id);
      const item = await tx.inspectionTemplateItem.findFirst({
        where: { id: itemId, inspectionTypeId: typeId, isActive: true },
      });
      if (!item) throw new NotFoundException('Active template item not found');
      const updated = await tx.inspectionTemplateItem.update({
        where: { id: itemId },
        data: { isActive: false },
      });
      await this.audit(
        tx,
        user,
        typeId,
        'TEMPLATE_ITEM_RETIRE',
        item,
        updated,
        ipAddress,
      );
      return updated;
    });
  }

  // ===================================================
  // CREATE AND UPDATE
  // ===================================================

  async create(
    user: AuthenticatedUser,
    dto: CreateInspectionDto,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertContext(tx, dto, user);
      await this.lockType(tx, dto.inspectionTypeId, user.company.id);
      const type = await tx.inspectionType.findFirst({
        where: {
          id: dto.inspectionTypeId,
          companyId: user.company.id,
          isActive: true,
        },
        include: { templateItems: { where: { isActive: true } } },
      });
      if (!type)
        throw new BadRequestException(
          'Inspection type is inactive or unavailable',
        );
      if (!type.templateItems.length)
        throw new BadRequestException(
          'Add checklist items to this inspection type first',
        );
      const id = randomUUID();
      const inspection = await tx.inspection.create({
        data: {
          inspectionTypeId: dto.inspectionTypeId,
          projectId: dto.projectId,
          siteId: dto.siteId,
          inspectorId: dto.inspectorId,
          id,
          inspectionNumber: await this.generateInspectionNumber(tx),
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
          checklistResponses: {
            create: type.templateItems.map((item) => ({
              templateItemId: item.id,
            })),
          },
        },
        include: inspectionInclude,
      });
      await this.audit(tx, user, id, 'CREATE', null, inspection, ipAddress);
      return inspection;
    });
  }

  async update(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateInspectionDto,
    ipAddress?: string,
  ) {
    if (!Object.keys(dto).length)
      throw new BadRequestException('Provide at least one field to update');
    return this.prisma.$transaction(async (tx) => {
      const inspection = await this.lockInspection(tx, id, user);
      this.assertStatus(inspection.status, ['DRAFT', 'SCHEDULED', 'REJECTED']);
      await this.assertContext(tx, inspection, user);
      const updated = await tx.inspection.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          ...(dto.scheduledAt !== undefined && {
            scheduledAt: new Date(dto.scheduledAt),
          }),
        },
        include: inspectionInclude,
      });
      await this.audit(tx, user, id, 'UPDATE', inspection, updated, ipAddress);
      return updated;
    });
  }

  // ===================================================
  // CHECKLIST AND FINDINGS
  // ===================================================

  async respond(
    id: string,
    responseId: string,
    user: AuthenticatedUser,
    dto: UpdateInspectionResponseDto,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const inspection = await this.lockInspection(tx, id, user);
      this.assertStatus(inspection.status, ['IN_PROGRESS']);
      const response = await tx.inspectionChecklistResponse.findFirst({
        where: { id: responseId, inspectionId: id },
      });
      if (!response)
        throw new NotFoundException('Checklist response not found');
      if (dto.result === 'NOT_APPLICABLE' && !dto.comments?.trim()) {
        throw new BadRequestException(
          'Explain why the checklist item is not applicable',
        );
      }
      const updated = await tx.inspectionChecklistResponse.update({
        where: { id: responseId },
        data: {
          result: dto.result,
          comments: dto.comments?.trim() || null,
          respondedById: user.id,
          respondedAt: new Date(),
        },
      });
      await this.audit(
        tx,
        user,
        id,
        'CHECKLIST_RESPONSE',
        response,
        updated,
        ipAddress,
      );
      return updated;
    });
  }

  async createFinding(
    id: string,
    user: AuthenticatedUser,
    dto: CreateInspectionFindingDto,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const inspection = await this.lockInspection(tx, id, user);
      this.assertStatus(inspection.status, ['IN_PROGRESS']);
      if (dto.checklistResponseId) {
        const response = await tx.inspectionChecklistResponse.findFirst({
          where: { id: dto.checklistResponseId, inspectionId: id },
        });
        if (!response)
          throw new NotFoundException(
            'Checklist response not found in this inspection',
          );
      }
      const finding = await tx.inspectionFinding.create({
        data: {
          title: dto.title,
          description: dto.description,
          findingType: dto.findingType,
          severity: dto.severity,
          checklistResponseId: dto.checklistResponseId,
          recommendedAction: dto.recommendedAction,
          location: dto.location,
          inspectionId: id,
          createdById: user.id,
        },
      });
      await this.audit(
        tx,
        user,
        id,
        'FINDING_CREATE',
        null,
        finding,
        ipAddress,
      );
      return finding;
    });
  }

  async closeFinding(
    id: string,
    findingId: string,
    user: AuthenticatedUser,
    comments: string | undefined,
    ipAddress?: string,
  ) {
    if (!comments?.trim())
      throw new BadRequestException(
        'A finding closure explanation is required',
      );
    return this.prisma.$transaction(async (tx) => {
      const inspection = await this.lockInspection(tx, id, user);
      this.assertStatus(inspection.status, ['APPROVED']);
      const finding = await tx.inspectionFinding.findFirst({
        where: { id: findingId, inspectionId: id },
      });
      if (!finding) throw new NotFoundException('Finding not found');
      if (finding.isClosed)
        throw new ConflictException('Finding is already closed');
      const updated = await tx.inspectionFinding.update({
        where: { id: findingId },
        data: { isClosed: true, closedAt: new Date() },
      });
      await this.audit(
        tx,
        user,
        id,
        'FINDING_CLOSE',
        finding,
        { ...updated, closureComments: comments.trim() },
        ipAddress,
      );
      return updated;
    });
  }

  // ===================================================
  // WORKFLOW
  // ===================================================

  async transition(
    id: string,
    user: AuthenticatedUser,
    action: 'schedule' | 'start' | 'submit' | 'approve' | 'reject' | 'close',
    comments?: string,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const inspection = await this.lockInspection(tx, id, user);
      const now = new Date();
      let data: Prisma.InspectionUpdateInput;
      switch (action) {
        case 'schedule':
          this.assertStatus(inspection.status, ['DRAFT']);
          if (!inspection.scheduledAt)
            throw new BadRequestException(
              'Set a scheduled date before scheduling',
            );
          await this.assertContext(tx, inspection, user);
          data = { status: 'SCHEDULED' };
          break;
        case 'start':
          this.assertStatus(inspection.status, [
            'DRAFT',
            'SCHEDULED',
            'REJECTED',
          ]);
          await this.assertContext(tx, inspection, user);
          data = {
            status: 'IN_PROGRESS',
            startedAt: inspection.startedAt ?? now,
            submittedAt: null,
            submittedBy: { disconnect: true },
            rejectionReason: null,
          };
          break;
        case 'submit': {
          this.assertStatus(inspection.status, ['IN_PROGRESS']);
          await this.assertContext(tx, inspection, user);
          const responses = await tx.inspectionChecklistResponse.findMany({
            where: { inspectionId: id },
            include: { templateItem: true, findings: true },
          });
          if (
            !responses.length ||
            responses.some(
              (response) =>
                response.templateItem.isMandatory && !response.result,
            )
          ) {
            throw new BadRequestException(
              'Complete every mandatory checklist item before submission',
            );
          }
          if (
            responses.some(
              (response) =>
                response.result === 'FAIL' && !response.findings.length,
            )
          ) {
            throw new BadRequestException(
              'Record a linked finding for every failed checklist item',
            );
          }
          data = {
            status: 'SUBMITTED',
            submittedAt: now,
            submittedBy: { connect: { id: user.id } },
          };
          break;
        }
        case 'approve':
          this.assertStatus(inspection.status, ['SUBMITTED']);
          data = {
            status: 'APPROVED',
            approvedAt: now,
            approvedBy: { connect: { id: user.id } },
            approvalComments: comments?.trim() || null,
            rejectionReason: null,
          };
          break;
        case 'reject':
          this.assertStatus(inspection.status, ['SUBMITTED']);
          if (!comments?.trim())
            throw new BadRequestException('A rejection reason is required');
          data = { status: 'REJECTED', rejectionReason: comments.trim() };
          break;
        case 'close':
          this.assertStatus(inspection.status, ['APPROVED']);
          if (
            await tx.inspectionFinding.count({
              where: { inspectionId: id, isClosed: false },
            })
          ) {
            throw new ConflictException(
              'Close all findings before closing this inspection',
            );
          }
          data = { status: 'CLOSED', closedAt: now };
          break;
      }
      const updated = await tx.inspection.update({
        where: { id },
        data,
        include: inspectionInclude,
      });
      await this.audit(
        tx,
        user,
        id,
        action.toUpperCase(),
        { status: inspection.status },
        {
          status: updated.status,
          comments: comments?.trim() || null,
        },
        ipAddress,
      );
      return updated;
    });
  }

  async getHistory(id: string, user: AuthenticatedUser) {
    await this.findOne(id, user);
    return this.prisma.auditLog.findMany({
      where: {
        companyId: user.company.id,
        module: 'inspections',
        recordId: id,
      },
      select: {
        id: true,
        action: true,
        oldValues: true,
        newValues: true,
        createdAt: true,
        user: { select: userSelect },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  // ===================================================
  // TRANSACTION HELPERS
  // ===================================================

  private async lockInspection(
    tx: Prisma.TransactionClient,
    id: string,
    user: AuthenticatedUser,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT i.id FROM inspections i
      JOIN projects p ON p.id = i."projectId"
      WHERE i.id = ${id}::uuid AND p."companyId" = ${user.company.id}::uuid
      FOR UPDATE OF i
    `;
    if (!rows.length) throw new NotFoundException('Inspection not found');
    const inspection = await tx.inspection.findFirst({
      where: { id, ...this.scope(user) },
    });
    if (!inspection) throw new NotFoundException('Inspection not found');
    return inspection;
  }

  private async lockType(
    tx: Prisma.TransactionClient,
    id: string,
    companyId: string,
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM inspection_types WHERE id = ${id}::uuid AND "companyId" = ${companyId}::uuid FOR UPDATE
    `;
    if (!rows.length) throw new NotFoundException('Inspection type not found');
  }

  private async assertContext(
    tx: Prisma.TransactionClient,
    context: { projectId: string; siteId: string; inspectorId: string },
    user: AuthenticatedUser,
  ) {
    // Match project/site lock ordering used by the existing permit service.
    await tx.$queryRaw`SELECT id FROM projects WHERE id = ${context.projectId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM sites WHERE id = ${context.siteId}::uuid FOR UPDATE`;
    const site = await tx.site.findFirst({
      where: {
        id: context.siteId,
        projectId: context.projectId,
        isActive: true,
        project: { companyId: user.company.id, isActive: true },
        ...(user.role.name !== 'SUPER_ADMIN' && {
          userAccess: { some: { userId: user.id } },
        }),
      },
    });
    if (!site)
      throw new NotFoundException(
        'Active project and accessible site not found',
      );
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${context.inspectorId}::uuid FOR UPDATE`;
    const inspector = await tx.user.findFirst({
      where: {
        id: context.inspectorId,
        companyId: user.company.id,
        isActive: true,
        role: { isActive: true },
        OR: [
          { role: { name: 'SUPER_ADMIN' } },
          { siteAccess: { some: { siteId: context.siteId } } },
        ],
      },
    });
    if (!inspector)
      throw new BadRequestException(
        'Inspector must be active in this company and have access to the site',
      );
  }

  private assertStatus(status: InspectionStatus, allowed: InspectionStatus[]) {
    if (!allowed.includes(status))
      throw new ConflictException(
        `This action requires status ${allowed.join(' or ')}`,
      );
  }

  private async generateInspectionNumber(tx: Prisma.TransactionClient) {
    const year = new Date().getUTCFullYear();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`inspection-number-${year}`}))`;
    // Numeric ordering continues correctly after the six-digit display width.
    const rows = await tx.$queryRaw<Array<{ sequence: string }>>`
      SELECT COALESCE(MAX(SUBSTRING("inspectionNumber" FROM 10)::bigint), 0)::text AS sequence
      FROM inspections WHERE "inspectionNumber" ~ ${`^INS-${year}-[0-9]+$`}
    `;
    return `INS-${year}-${String(BigInt(rows[0].sequence) + 1n).padStart(6, '0')}`;
  }

  private audit(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    recordId: string,
    action: string,
    oldValues: unknown,
    newValues: unknown,
    ipAddress?: string,
  ) {
    return tx.auditLog.create({
      data: {
        companyId: user.company.id,
        userId: user.id,
        module: 'inspections',
        recordId,
        action,
        ...(oldValues !== null && {
          oldValues: JSON.parse(
            JSON.stringify(oldValues),
          ) as Prisma.InputJsonValue,
        }),
        newValues: JSON.parse(
          JSON.stringify(newValues),
        ) as Prisma.InputJsonValue,
        ipAddress: ipAddress ?? null,
      },
    });
  }

  private isUniqueError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

import { CreateProjectDto } from './dto/create-project.dto.js';

import { UpdateProjectDto } from './dto/update-project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // =====================================
  // DATE VALIDATION
  // =====================================

  private parseDate(
    value: string | undefined,
    field: string,
  ): Date | undefined {
    if (value === undefined) {
      return undefined;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(
        `${field} must be a valid date in YYYY-MM-DD format`,
      );
    }

    return date;
  }

  private validateDateRange(
    startDate?: Date | null,
    endDate?: Date | null,
  ): void {
    if (
      startDate &&
      endDate &&
      startDate.getTime() > endDate.getTime()
    ) {
      throw new BadRequestException(
        'Start date cannot be later than end date',
      );
    }
  }

  // =====================================
  // DATABASE ERROR HANDLING
  // =====================================

  private handleDatabaseError(error: unknown): never {
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A project with this code already exists',
      );
    }

    throw error;
  }

  // =====================================
  // 1. LIST PROJECTS
  // =====================================

  async findAll(companyId: string) {
    return this.prisma.project.findMany({
      where: {
        companyId,
      },

      select: {
        id: true,
        name: true,
        code: true,
        clientName: true,
        startDate: true,
        endDate: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,

        _count: {
          select: {
            sites: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // =====================================
  // 2. CREATE PROJECT
  // =====================================

  async create(
    companyId: string,
    userId: string,
    dto: CreateProjectDto,
  ) {
    const name = dto.name.trim();
    const code = dto.code.trim();

    if (!name) {
      throw new BadRequestException(
        'Project name is required',
      );
    }

    if (!code) {
      throw new BadRequestException(
        'Project code is required',
      );
    }

    const clientName =
      dto.clientName?.trim() || null;

    const startDate = this.parseDate(
      dto.startDate,
      'startDate',
    );

    const endDate = this.parseDate(
      dto.endDate,
      'endDate',
    );

    this.validateDateRange(startDate, endDate);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.project.findFirst({
          where: {
            companyId,
            code,
          },
        });

        if (existing) {
          throw new ConflictException(
            'A project with this code already exists',
          );
        }

        const project = await tx.project.create({
          data: {
            companyId,
            name,
            code,
            clientName,
            startDate,
            endDate,
            isActive: true,
          },
        });

        await tx.auditLog.create({
          data: {
            companyId,
            userId,

            module: 'projects',
            action: 'CREATE',
            recordId: project.id,

            newValues: {
              name: project.name,
              code: project.code,
              clientName: project.clientName,
              startDate: project.startDate?.toISOString() ?? null,
              endDate: project.endDate?.toISOString() ?? null,
              isActive: project.isActive,
            },
          },
        });

        return project;
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  // =====================================
  // 3. UPDATE PROJECT
  // =====================================

  async update(
    companyId: string,
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'Provide at least one field to update',
      );
    }

    const name =
      dto.name !== undefined
        ? dto.name.trim()
        : undefined;

    if (name !== undefined && !name) {
      throw new BadRequestException(
        'Project name cannot be empty',
      );
    }

    const startDate = this.parseDate(
      dto.startDate,
      'startDate',
    );

    const endDate = this.parseDate(
      dto.endDate,
      'endDate',
    );

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.project.findFirst({
        where: {
          id: projectId,
          companyId,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          'Project not found',
        );
      }

      if (!existing.isActive) {
        throw new ConflictException(
          'Inactive projects cannot be edited',
        );
      }

      // Use existing dates for fields not included
      // in the PATCH request.
      const finalStartDate =
        startDate !== undefined
          ? startDate
          : existing.startDate;

      const finalEndDate =
        endDate !== undefined
          ? endDate
          : existing.endDate;

      this.validateDateRange(
        finalStartDate,
        finalEndDate,
      );

      const result = await tx.project.updateMany({
        where: {
          id: projectId,
          companyId,
          isActive: true,
        },

        data: {
          ...(name !== undefined && {
            name,
          }),

          ...(dto.clientName !== undefined && {
            clientName:
              dto.clientName.trim() || null,
          }),

          ...(startDate !== undefined && {
            startDate,
          }),

          ...(endDate !== undefined && {
            endDate,
          }),
        },
      });

      if (result.count !== 1) {
        throw new ConflictException(
          'Project could not be updated',
        );
      }

      const updated = await tx.project.findFirstOrThrow({
        where: {
          id: projectId,
          companyId,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,

          module: 'projects',
          action: 'UPDATE',
          recordId: projectId,

          oldValues: {
            name: existing.name,
            clientName: existing.clientName,
            startDate:
              existing.startDate?.toISOString() ?? null,
            endDate:
              existing.endDate?.toISOString() ?? null,
          },

          newValues: {
            name: updated.name,
            clientName: updated.clientName,
            startDate:
              updated.startDate?.toISOString() ?? null,
            endDate:
              updated.endDate?.toISOString() ?? null,
          },
        },
      });

      return updated;
    });
  }

  // =====================================
  // 4. DEACTIVATE PROJECT
  // =====================================

 // =====================================
// DEACTIVATE PROJECT
// With project-row locking
// =====================================

async deactivate(
  companyId: string,
  userId: string,
  projectId: string,
) {
  return this.prisma.$transaction(async (tx) => {

    // 1. Lock the project row.
    // Site creation will acquire this same lock.

    const lockedProjects = await tx.$queryRaw<
      Array<{ id: string }>
    >`
      SELECT "id"
      FROM "projects"
      WHERE "id" = ${projectId}::uuid
        AND "companyId" = ${companyId}::uuid
      FOR UPDATE
    `;

    if (lockedProjects.length === 0) {
      throw new NotFoundException(
        'Project not found',
      );
    }

    // 2. Read the project after acquiring the lock.

    const project = await tx.project.findFirst({
      where: {
        id: projectId,
        companyId,
      },
    });

    if (!project) {
      throw new NotFoundException(
        'Project not found',
      );
    }

    if (!project.isActive) {
      throw new ConflictException(
        'Project is already inactive',
      );
    }

    // 3. Check active sites while holding the lock.

    const activeSites = await tx.site.count({
      where: {
        projectId,
        isActive: true,
      },
    });

    if (activeSites > 0) {
      throw new ConflictException(
        'Cannot deactivate a project with active sites',
      );
    }

    // 4. Update the project.

    const result = await tx.project.updateMany({
      where: {
        id: projectId,
        companyId,
        isActive: true,
      },

      data: {
        isActive: false,
      },
    });

    if (result.count !== 1) {
      throw new ConflictException(
        'Project could not be deactivated',
      );
    }

    // 5. Record the change in the same transaction.

    await tx.auditLog.create({
      data: {
        companyId,
        userId,

        module: 'projects',
        action: 'DEACTIVATE',
        recordId: projectId,

        oldValues: {
          isActive: true,
        },

        newValues: {
          isActive: false,
        },
      },
    });

    return {
      message: 'Project deactivated successfully',
      projectId,
    };
  });
}
}
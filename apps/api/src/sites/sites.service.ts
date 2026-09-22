import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

import { CreateSiteDto } from './dto/create-site.dto.js';

import { UpdateSiteDto } from './dto/update-site.dto.js';

@Injectable()
export class SitesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // =====================================
  // COMMON HELPERS
  // =====================================

  private handleDatabaseError(error: unknown): never {
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A site with this code already exists in the project',
      );
    }

    throw error;
  }

  private validateCoordinates(
    latitude?: number,
    longitude?: number,
  ) {
    if (
      (latitude === undefined) !==
      (longitude === undefined)
    ) {
      throw new BadRequestException(
        'Latitude and longitude must be supplied together',
      );
    }
  }

  // =====================================
  // 1. LIST ACCESSIBLE SITES
  // =====================================

  async findAll(
    companyId: string,
    userId: string,
    roleName: string,
  ) {
    return this.prisma.site.findMany({
      where: {
        project: {
          is: {
            companyId,
          },
        },

        ...(roleName !== 'SUPER_ADMIN' && {
          isActive: true,
          project: {
            is: {
              companyId,
              isActive: true,
            },
          },
          userAccess: {
            some: {
              userId,
            },
          },
        }),
      },

      select: {
        id: true,
        projectId: true,
        name: true,
        code: true,
        location: true,
        latitude: true,
        longitude: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,

        project: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },

        _count: {
          select: {
            userAccess: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // =====================================
  // 2. CREATE SITE
  // =====================================

  // =====================================
// CREATE SITE
// With parent-project locking
// =====================================

async create(
  companyId: string,
  userId: string,
  dto: CreateSiteDto,
) {
  const name = dto.name.trim();
  const code = dto.code.trim();

  if (!name || !code) {
    throw new BadRequestException(
      'Site name and code are required',
    );
  }

  this.validateCoordinates(
    dto.latitude,
    dto.longitude,
  );

  try {
    return await this.prisma.$transaction(async (tx) => {

      // 1. Lock the parent project.
      // Project deactivation acquires this same lock.

      const lockedProjects = await tx.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT "id"
        FROM "projects"
        WHERE "id" = ${dto.projectId}::uuid
          AND "companyId" = ${companyId}::uuid
        FOR UPDATE
      `;

      if (lockedProjects.length === 0) {
        throw new NotFoundException(
          'Active project not found',
        );
      }

      // 2. Verify project status after acquiring the lock.

      const project = await tx.project.findFirst({
        where: {
          id: dto.projectId,
          companyId,
          isActive: true,
        },
      });

      if (!project) {
        throw new NotFoundException(
          'Active project not found',
        );
      }

      // 3. Check duplicate site codes.

      const existing = await tx.site.findFirst({
        where: {
          projectId: project.id,
          code,
        },
      });

      if (existing) {
        throw new ConflictException(
          'A site with this code already exists in the project',
        );
      }

      // 4. Create the site.

      const site = await tx.site.create({
        data: {
          projectId: project.id,

          name,
          code,

          location:
            dto.location?.trim() || null,

          latitude: dto.latitude,
          longitude: dto.longitude,

          isActive: true,
        },
      });

      // 5. Record the change in the same transaction.

      await tx.auditLog.create({
        data: {
          companyId,
          userId,

          module: 'sites',
          action: 'CREATE',
          recordId: site.id,

          newValues: {
            name: site.name,
            code: site.code,
            projectId: site.projectId,
            location: site.location,

            latitude:
              site.latitude?.toString() ?? null,

            longitude:
              site.longitude?.toString() ?? null,
          },
        },
      });

      return site;
    });
  } catch (error) {
    this.handleDatabaseError(error);
  }
}

  // =====================================
  // 3. UPDATE SITE
  // =====================================

  async update(
    companyId: string,
    userId: string,
    siteId: string,
    dto: UpdateSiteDto,
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
        'Site name cannot be empty',
      );
    }

    if (
      dto.latitude !== undefined ||
      dto.longitude !== undefined
    ) {
      if (
        dto.latitude === undefined ||
        dto.longitude === undefined
      ) {
        throw new BadRequestException(
          'Update latitude and longitude together',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.site.findFirst({
        where: {
          id: siteId,

          project: {
            is: {
              companyId,
              isActive: true,
            },
          },
        },
      });

      if (!existing) {
        throw new NotFoundException(
          'Site not found',
        );
      }

      if (!existing.isActive) {
        throw new ConflictException(
          'Inactive sites cannot be edited',
        );
      }

      const result = await tx.site.updateMany({
        where: {
          id: siteId,
          projectId: existing.projectId,
          isActive: true,
        },

        data: {
          ...(name !== undefined && {
            name,
          }),

          ...(dto.location !== undefined && {
            location: dto.location.trim() || null,
          }),

          ...(dto.latitude !== undefined && {
            latitude: dto.latitude,
            longitude: dto.longitude,
          }),
        },
      });

      if (result.count !== 1) {
        throw new ConflictException(
          'Site could not be updated',
        );
      }

      const updated = await tx.site.findFirstOrThrow({
        where: {
          id: siteId,
          projectId: existing.projectId,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,

          module: 'sites',
          action: 'UPDATE',
          recordId: siteId,

          oldValues: {
            name: existing.name,
            location: existing.location,
            latitude: existing.latitude?.toString() ?? null,
            longitude: existing.longitude?.toString() ?? null,
          },

          newValues: {
            name: updated.name,
            location: updated.location,
            latitude: updated.latitude?.toString() ?? null,
            longitude: updated.longitude?.toString() ?? null,
          },
        },
      });

      return updated;
    });
  }

  // =====================================
  // 4. DEACTIVATE SITE
  // =====================================

  async deactivate(
    companyId: string,
    userId: string,
    siteId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const site = await tx.site.findFirst({
        where: {
          id: siteId,
          project: {
            is: {
              companyId,
            },
          },
        },
      });

      if (!site) {
        throw new NotFoundException(
          'Site not found',
        );
      }

      if (!site.isActive) {
        throw new ConflictException(
          'Site is already inactive',
        );
      }

      const result = await tx.site.updateMany({
        where: {
          id: siteId,
          projectId: site.projectId,
          isActive: true,
        },

        data: {
          isActive: false,
        },
      });

      if (result.count !== 1) {
        throw new ConflictException(
          'Site could not be deactivated',
        );
      }

      await tx.auditLog.create({
        data: {
          companyId,
          userId,

          module: 'sites',
          action: 'DEACTIVATE',
          recordId: siteId,

          oldValues: {
            isActive: true,
          },

          newValues: {
            isActive: false,
          },
        },
      });

      return {
        message: 'Site deactivated successfully',
        siteId,
      };
    });
  }

  // =====================================
  // 5. LIST SITE ASSIGNMENTS
  // =====================================

  async getAssignments(
    companyId: string,
    siteId: string,
  ) {
    const site = await this.prisma.site.findFirst({
      where: {
        id: siteId,
        project: {
          is: {
            companyId,
          },
        },
      },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    return this.prisma.userSiteAccess.findMany({
      where: {
        siteId,
        user: {
          is: {
            companyId,
          },
        },
      },

      select: {
        id: true,
        userId: true,
        createdAt: true,

        user: {
          select: {
            id: true,
            username: true,
            email: true,
            isActive: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // =====================================
  // 6. ASSIGN USER TO SITE
  // =====================================

  async assignUser(
    companyId: string,
    actorId: string,
    siteId: string,
    targetUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const site = await tx.site.findFirst({
        where: {
          id: siteId,
          isActive: true,

          project: {
            is: {
              companyId,
              isActive: true,
            },
          },
        },
      });

      if (!site) {
        throw new NotFoundException(
          'Active site not found',
        );
      }

      const user = await tx.user.findFirst({
        where: {
          id: targetUserId,
          companyId,
          isActive: true,
          role: {
            is: {
              isActive: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(
          'Active user not found in this company',
        );
      }

      const result = await tx.userSiteAccess.createMany({
        data: [{
          siteId,
          userId: targetUserId,
        }],

        skipDuplicates: true,
      });

      if (result.count === 0) {
        return {
          message: 'User is already assigned to this site',
          siteId,
          userId: targetUserId,
        };
      }

      await tx.auditLog.create({
        data: {
          companyId,
          userId: actorId,

          module: 'sites',
          action: 'ASSIGN_USER',
          recordId: siteId,

          newValues: {
            siteId,
            assignedUserId: targetUserId,
          },
        },
      });

      return {
        message: 'User assigned successfully',
        siteId,
        userId: targetUserId,
      };
    });
  }

  // =====================================
  // 7. REMOVE USER ASSIGNMENT
  // =====================================

  async removeAssignment(
    companyId: string,
    actorId: string,
    siteId: string,
    targetUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const site = await tx.site.findFirst({
        where: {
          id: siteId,

          project: {
            is: {
              companyId,
            },
          },
        },
      });

      if (!site) {
        throw new NotFoundException(
          'Site not found',
        );
      }

      const user = await tx.user.findFirst({
        where: {
          id: targetUserId,
          companyId,
        },
      });

      if (!user) {
        throw new NotFoundException(
          'User not found in this company',
        );
      }

      const result = await tx.userSiteAccess.deleteMany({
        where: {
          siteId,
          userId: targetUserId,
        },
      });

      if (result.count === 0) {
        throw new NotFoundException(
          'Site assignment not found',
        );
      }

      await tx.auditLog.create({
        data: {
          companyId,
          userId: actorId,

          module: 'sites',
          action: 'REMOVE_USER',
          recordId: siteId,

          oldValues: {
            siteId,
            assignedUserId: targetUserId,
          },
        },
      });

      return {
        message: 'Site assignment removed successfully',
        siteId,
        userId: targetUserId,
      };
    });
  }
}
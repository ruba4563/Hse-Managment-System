import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

import { CreateDepartmentDto } from './dto/create-department.dto.js';

import { UpdateDepartmentDto } from './dto/update-department.dto.js';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // -----------------------------------------
  // Handle unique-constraint violations
  // -----------------------------------------

  private handleDatabaseError(error: unknown): never {
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A department with this name already exists',
      );
    }

    throw error;
  }

  // -----------------------------------------
  // 1. List departments
  // -----------------------------------------

  async findAll(companyId: string) {
    return this.prisma.department.findMany({
      where: {
        companyId,
      },

      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,

        _count: {
          select: {
            employees: true,
          },
        },
      },

      orderBy: {
        name: 'asc',
      },
    });
  }

  // -----------------------------------------
  // 2. Create department
  // -----------------------------------------

  async create(
    companyId: string,
    userId: string,
    dto: CreateDepartmentDto,
  ) {
    const name = dto.name.trim();

    if (!name) {
      throw new BadRequestException(
        'Department name cannot be empty',
      );
    }

    const description =
      dto.description?.trim() || null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.department.findFirst({
          where: {
            companyId,
            name,
          },
        });

        if (existing) {
          throw new ConflictException(
            'A department with this name already exists',
          );
        }

        const department = await tx.department.create({
          data: {
            companyId,
            name,
            description,
            isActive: true,
          },
        });

        await tx.auditLog.create({
          data: {
            companyId,
            userId,

            module: 'departments',
            action: 'CREATE',
            recordId: department.id,

            newValues: {
              name: department.name,
              description: department.description,
              isActive: department.isActive,
            },
          },
        });

        return department;
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  // -----------------------------------------
  // 3. Update department
  // -----------------------------------------

  async update(
    companyId: string,
    userId: string,
    departmentId: string,
    dto: UpdateDepartmentDto,
  ) {
    if (
      dto.name === undefined &&
      dto.description === undefined
    ) {
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
        'Department name cannot be empty',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.department.findFirst({
          where: {
            id: departmentId,
            companyId,
          },
        });

        if (!existing) {
          throw new NotFoundException(
            'Department not found',
          );
        }

        if (!existing.isActive) {
          throw new ConflictException(
            'Inactive departments cannot be edited',
          );
        }

        if (name !== undefined && name !== existing.name) {
          const duplicate = await tx.department.findFirst({
            where: {
              companyId,
              name,
              id: {
                not: departmentId,
              },
            },
          });

          if (duplicate) {
            throw new ConflictException(
              'A department with this name already exists',
            );
          }
        }

        const result = await tx.department.updateMany({
          where: {
            id: departmentId,
            companyId,
            isActive: true,
          },

          data: {
            ...(name !== undefined && {
              name,
            }),

            ...(dto.description !== undefined && {
              description:
                dto.description.trim() || null,
            }),
          },
        });

        if (result.count !== 1) {
          throw new ConflictException(
            'Department could not be updated',
          );
        }

        const updated = await tx.department.findFirstOrThrow({
          where: {
            id: departmentId,
            companyId,
          },
        });

        await tx.auditLog.create({
          data: {
            companyId,
            userId,

            module: 'departments',
            action: 'UPDATE',
            recordId: departmentId,

            oldValues: {
              name: existing.name,
              description: existing.description,
            },

            newValues: {
              name: updated.name,
              description: updated.description,
            },
          },
        });

        return updated;
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  // -----------------------------------------
  // 4. Deactivate department
  // -----------------------------------------

  // =====================================
// DEACTIVATE DEPARTMENT
// Protected against concurrent employee
// creation and department assignment.
// =====================================

async deactivate(
  companyId: string,
  userId: string,
  departmentId: string,
) {
  return this.prisma.$transaction(async (tx) => {

    // 1. Lock the department row.
    // Employee creation and reassignment
    // must acquire this same lock.

    const lockedDepartments = await tx.$queryRaw<
      Array<{ id: string }>
    >`
      SELECT "id"
      FROM "departments"
      WHERE "id" = ${departmentId}::uuid
        AND "companyId" = ${companyId}::uuid
      FOR UPDATE
    `;

    if (lockedDepartments.length === 0) {
      throw new NotFoundException(
        'Department not found',
      );
    }

    // 2. Check status AFTER acquiring the lock.

    const department =
      await tx.department.findFirst({
        where: {
          id: departmentId,
          companyId,
        },
      });

    if (!department) {
      throw new NotFoundException(
        'Department not found',
      );
    }

    if (!department.isActive) {
      throw new ConflictException(
        'Department is already inactive',
      );
    }

    // 3. Count active employees while
    // holding the parent department lock.

    const activeEmployees =
      await tx.employee.count({
        where: {
          companyId,
          departmentId,
          isActive: true,
        },
      });

    if (activeEmployees > 0) {
      throw new ConflictException(
        'Cannot deactivate a department with active employees',
      );
    }

    // 4. Deactivate the department.

    const result =
      await tx.department.updateMany({
        where: {
          id: departmentId,
          companyId,
          isActive: true,
        },

        data: {
          isActive: false,
        },
      });

    if (result.count !== 1) {
      throw new ConflictException(
        'Department could not be deactivated',
      );
    }

    // 5. Record the operation in the
    // same database transaction.

    await tx.auditLog.create({
      data: {
        companyId,
        userId,

        module: 'departments',
        action: 'DEACTIVATE',
        recordId: departmentId,

        oldValues: {
          isActive: true,
        },

        newValues: {
          isActive: false,
        },
      },
    });

    return {
      message: 'Department deactivated successfully',
      departmentId,
    };
  });
}
}
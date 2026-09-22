import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

import { CreateEmployeeDto } from './dto/create-employee.dto.js';

import { UpdateEmployeeDto } from './dto/update-employee.dto.js';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // =====================================
  // COMMON SELECT
  // =====================================

  private readonly employeeSelect = {
    id: true,
    employeeNumber: true,
    fullName: true,
    departmentId: true,
    email: true,
    phone: true,
    jobTitle: true,
    employmentType: true,
    hireDate: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,

    department: {
      select: {
        id: true,
        name: true,
      },
    },
  } as const;

  // =====================================
  // VALIDATE DATE
  // =====================================

  private parseDate(
    value: string | undefined,
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
        'hireDate must be a valid YYYY-MM-DD date',
      );
    }

    return date;
  }

  // =====================================
  // DATABASE ERRORS
  // =====================================

  private handleDatabaseError(error: unknown): never {
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Employee number already exists in this company',
      );
    }

    throw error;
  }

  // =====================================
  // 1. LIST EMPLOYEES
  // =====================================

  async findAll(companyId: string) {
    return this.prisma.employee.findMany({
      where: {
        companyId,
      },

      select: this.employeeSelect,

      orderBy: {
        fullName: 'asc',
      },
    });
  }

  // =====================================
  // 2. CREATE EMPLOYEE
  // =====================================

  async create(
    companyId: string,
    actorId: string,
    dto: CreateEmployeeDto,
  ) {
    const employeeNumber =
      dto.employeeNumber.trim();

    const fullName =
      dto.fullName.trim();

    if (!employeeNumber || !fullName) {
      throw new BadRequestException(
        'Employee number and full name are required',
      );
    }

    const hireDate = this.parseDate(
      dto.hireDate,
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Validate department ownership.
        if (dto.departmentId) {
          const department =
            await tx.department.findFirst({
              where: {
                id: dto.departmentId,
                companyId,
                isActive: true,
              },
            });

          if (!department) {
            throw new BadRequestException(
              'Invalid or inactive department',
            );
          }
        }

        const existing = await tx.employee.findFirst({
          where: {
            companyId,
            employeeNumber,
          },
        });

        if (existing) {
          throw new ConflictException(
            'Employee number already exists in this company',
          );
        }

        const employee = await tx.employee.create({
          data: {
            companyId,

            employeeNumber,
            fullName,

            departmentId:
              dto.departmentId ?? null,

            email: dto.email?.trim() || null,
            phone: dto.phone?.trim() || null,
            jobTitle: dto.jobTitle?.trim() || null,

            employmentType:
              dto.employmentType ?? 'EMPLOYEE',

            hireDate,
            isActive: true,
          },

          select: this.employeeSelect,
        });

        await tx.auditLog.create({
          data: {
            companyId,
            userId: actorId,

            module: 'employees',
            action: 'CREATE',
            recordId: employee.id,

            newValues: {
              employeeNumber: employee.employeeNumber,
              departmentId: employee.departmentId,
              employmentType: employee.employmentType,
              isActive: true,
            },
          },
        });

        return employee;
      });
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  // =====================================
  // 3. UPDATE EMPLOYEE
  // =====================================

  async update(
    companyId: string,
    actorId: string,
    employeeId: string,
    dto: UpdateEmployeeDto,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'Provide at least one field to update',
      );
    }

    const fullName =
      dto.fullName !== undefined
        ? dto.fullName.trim()
        : undefined;

    if (fullName !== undefined && !fullName) {
      throw new BadRequestException(
        'Employee name cannot be empty',
      );
    }

    const hireDate = this.parseDate(
      dto.hireDate,
    );

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.employee.findFirst({
        where: {
          id: employeeId,
          companyId,
        },
      });

      if (!existing) {
        throw new NotFoundException(
          'Employee not found',
        );
      }

      if (!existing.isActive) {
        throw new ConflictException(
          'Inactive employees cannot be edited',
        );
      }

      // Validate any new department assignment.
      if (dto.departmentId) {
        const department =
          await tx.department.findFirst({
            where: {
              id: dto.departmentId,
              companyId,
              isActive: true,
            },
          });

        if (!department) {
          throw new BadRequestException(
            'Invalid or inactive department',
          );
        }
      }

      const result = await tx.employee.updateMany({
        where: {
          id: employeeId,
          companyId,
          isActive: true,
        },

        data: {
          ...(fullName !== undefined && {
            fullName,
          }),

          ...(dto.departmentId !== undefined && {
            departmentId: dto.departmentId,
          }),

          ...(dto.email !== undefined && {
            email: dto.email.trim() || null,
          }),

          ...(dto.phone !== undefined && {
            phone: dto.phone.trim() || null,
          }),

          ...(dto.jobTitle !== undefined && {
            jobTitle: dto.jobTitle.trim() || null,
          }),

          ...(dto.employmentType !== undefined && {
            employmentType: dto.employmentType,
          }),

          ...(hireDate !== undefined && {
            hireDate,
          }),
        },
      });

      if (result.count !== 1) {
        throw new ConflictException(
          'Employee could not be updated',
        );
      }

      const updated = await tx.employee.findFirstOrThrow({
        where: {
          id: employeeId,
          companyId,
        },

        select: this.employeeSelect,
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId: actorId,

          module: 'employees',
          action: 'UPDATE',
          recordId: employeeId,

          oldValues: {
            departmentId: existing.departmentId,
            employmentType: existing.employmentType,
            isActive: existing.isActive,
          },

          newValues: {
            departmentId: updated.departmentId,
            employmentType: updated.employmentType,
            isActive: updated.isActive,
          },
        },
      });

      return updated;
    });
  }

  // =====================================
  // 4. DEACTIVATE EMPLOYEE
  // =====================================

  async deactivate(
    companyId: string,
    actorId: string,
    employeeId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: {
          id: employeeId,
          companyId,
        },

        include: {
          user: {
            select: {
              id: true,
              isActive: true,
            },
          },
        },
      });

      if (!employee) {
        throw new NotFoundException(
          'Employee not found',
        );
      }

      if (!employee.isActive) {
        throw new ConflictException(
          'Employee is already inactive',
        );
      }

      // Do not leave an active login account
      // attached to an inactive employee.
      if (employee.user?.isActive) {
        throw new ConflictException(
          'Disable the linked user account before deactivating this employee',
        );
      }

      const result = await tx.employee.updateMany({
        where: {
          id: employeeId,
          companyId,
          isActive: true,
        },

        data: {
          isActive: false,
        },
      });

      if (result.count !== 1) {
        throw new ConflictException(
          'Employee could not be deactivated',
        );
      }

      await tx.auditLog.create({
        data: {
          companyId,
          userId: actorId,

          module: 'employees',
          action: 'DEACTIVATE',
          recordId: employeeId,

          oldValues: {
            isActive: true,
          },

          newValues: {
            isActive: false,
          },
        },
      });

      return {
        message: 'Employee deactivated successfully',
        employeeId,
      };
    });
  }
}
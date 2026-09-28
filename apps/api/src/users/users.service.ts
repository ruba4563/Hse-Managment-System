import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import bcrypt from 'bcryptjs';

import type { Prisma } from '../generated/prisma/client.js';

import { PrismaService } from '../prisma/prisma.service.js';

import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // =====================================================
  // COMMON USER SELECT
  // =====================================================

  private readonly userSelect = {
    id: true,
    username: true,
    email: true,
    isActive: true,
    employeeId: true,
    createdAt: true,
    updatedAt: true,

    role: {
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    },

    employee: {
      select: {
        id: true,
        employeeNumber: true,
        fullName: true,
        jobTitle: true,
        isActive: true,

        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },

    _count: {
      select: {
        siteAccess: true,
      },
    },
  } satisfies Prisma.UserSelect;

  // =====================================================
  // LIST USERS
  // =====================================================

  async findAll(
    companyId: string,
  ) {
    return this.prisma.user.findMany({
      where: {
        companyId,
      },

      select: this.userSelect,

      orderBy: {
        username: 'asc',
      },
    });
  }

  // =====================================================
  // LIST ACTIVE ROLES
  // =====================================================

  async findRoles() {
    return this.prisma.role.findMany({
      where: {
        isActive: true,
      },

      select: {
        id: true,
        name: true,
      },

      orderBy: {
        name: 'asc',
      },
    });
  }

  // =====================================================
  // AVAILABLE EMPLOYEES
  // =====================================================

  async findAvailableEmployees(
    companyId: string,
  ) {
    return this.prisma.employee.findMany({
      where: {
        companyId,
        isActive: true,

        user: {
          is: null,
        },
      },

      select: {
        id: true,
        employeeNumber: true,
        fullName: true,
        email: true,
        jobTitle: true,

        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },

      orderBy: {
        fullName: 'asc',
      },
    });
  }

  // =====================================================
  // CREATE USER
  // =====================================================

  async create(
    companyId: string,
    actorId: string,
    dto: CreateUserDto,
  ) {
    const username =
      dto.username.trim().toLowerCase();

    const email =
      dto.email.trim().toLowerCase();

    if (!username) {
      throw new BadRequestException(
        'Username is required',
      );
    }

    if (!email) {
      throw new BadRequestException(
        'Email is required',
      );
    }

    const passwordHash =
      await bcrypt.hash(
        dto.password,
        12,
      );

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // ---------------------------------------------
          // 1. Validate employee
          // ---------------------------------------------

          const employee =
            await tx.employee.findFirst({
              where: {
                id: dto.employeeId,
                companyId,
                isActive: true,
              },

              include: {
                user: {
                  select: {
                    id: true,
                  },
                },
              },
            });

          if (!employee) {
            throw new NotFoundException(
              'Active employee not found in this company',
            );
          }

          if (employee.user) {
            throw new ConflictException(
              'This employee already has a user account',
            );
          }

          // ---------------------------------------------
          // 2. Validate role
          // ---------------------------------------------

          const role =
            await tx.role.findFirst({
              where: {
                id: dto.roleId,
                isActive: true,
              },

              select: {
                id: true,
                name: true,
              },
            });

          if (!role) {
            throw new BadRequestException(
              'Invalid or inactive role',
            );
          }

          // ---------------------------------------------
          // 3. Check username uniqueness
          // ---------------------------------------------

          const existingUsername =
            await tx.user.findFirst({
              where: {
                username: {
                  equals: username,
                  mode: 'insensitive',
                },
              },

              select: {
                id: true,
              },
            });

          if (existingUsername) {
            throw new ConflictException(
              'Username already exists',
            );
          }

          // ---------------------------------------------
          // 4. Check email uniqueness
          // ---------------------------------------------

          const existingEmail =
            await tx.user.findFirst({
              where: {
                email: {
                  equals: email,
                  mode: 'insensitive',
                },
              },

              select: {
                id: true,
              },
            });

          if (existingEmail) {
            throw new ConflictException(
              'Email already belongs to another user',
            );
          }

          // ---------------------------------------------
          // 5. Create account
          // ---------------------------------------------

          const user =
            await tx.user.create({
              data: {
                companyId,
                employeeId: employee.id,
                roleId: role.id,

                username,
                email,
                passwordHash,

                isActive: true,
              },

              select: this.userSelect,
            });

          // ---------------------------------------------
          // 6. Audit
          // ---------------------------------------------

          await tx.auditLog.create({
            data: {
              companyId,
              userId: actorId,

              module: 'users',
              action: 'CREATE',
              recordId: user.id,

              newValues: {
                username:
                  user.username,

                employeeId:
                  user.employeeId,

                roleId:
                  role.id,

                isActive:
                  user.isActive,
              },
            },
          });

          return user;
        },
      );
    } catch (error) {
      if (
        error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'User account already exists',
        );
      }

      throw error;
    }
  }

  // =====================================================
  // UPDATE USER
  // =====================================================

  async update(
    companyId: string,
    actorId: string,
    targetUserId: string,
    dto: UpdateUserDto,
  ) {
    if (
      Object.keys(dto).length === 0
    ) {
      throw new BadRequestException(
        'Provide at least one field to update',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        // ---------------------------------------------
        // 1. Find target user
        // ---------------------------------------------

        const existing =
          await tx.user.findFirst({
            where: {
              id: targetUserId,
              companyId,
            },

            select: {
              id: true,
              username: true,
              email: true,
              roleId: true,
              isActive: true,
            },
          });

        if (!existing) {
          throw new NotFoundException(
            'User not found',
          );
        }

        // ---------------------------------------------
        // 2. Normalize fields
        // ---------------------------------------------

        const username =
          dto.username !== undefined
            ? dto.username
                .trim()
                .toLowerCase()
            : undefined;

        const email =
          dto.email !== undefined
            ? dto.email
                .trim()
                .toLowerCase()
            : undefined;

        if (
          username !== undefined &&
          !username
        ) {
          throw new BadRequestException(
            'Username cannot be empty',
          );
        }

        if (
          email !== undefined &&
          !email
        ) {
          throw new BadRequestException(
            'Email cannot be empty',
          );
        }

        // ---------------------------------------------
        // 3. Prevent own role change
        // ---------------------------------------------

        if (
          targetUserId === actorId &&
          dto.roleId !== undefined &&
          dto.roleId !== existing.roleId
        ) {
          throw new ForbiddenException(
            'You cannot change your own role',
          );
        }

        // ---------------------------------------------
        // 4. Validate new role
        // ---------------------------------------------

        if (dto.roleId !== undefined) {
          const role =
            await tx.role.findFirst({
              where: {
                id: dto.roleId,
                isActive: true,
              },

              select: {
                id: true,
              },
            });

          if (!role) {
            throw new BadRequestException(
              'Invalid or inactive role',
            );
          }
        }

        // ---------------------------------------------
        // 5. Username uniqueness
        // ---------------------------------------------

        if (username !== undefined) {
          const duplicate =
            await tx.user.findFirst({
              where: {
                username: {
                  equals: username,
                  mode: 'insensitive',
                },

                id: {
                  not: targetUserId,
                },
              },

              select: {
                id: true,
              },
            });

          if (duplicate) {
            throw new ConflictException(
              'Username already exists',
            );
          }
        }

        // ---------------------------------------------
        // 6. Email uniqueness
        // ---------------------------------------------

        if (email !== undefined) {
          const duplicate =
            await tx.user.findFirst({
              where: {
                email: {
                  equals: email,
                  mode: 'insensitive',
                },

                id: {
                  not: targetUserId,
                },
              },

              select: {
                id: true,
              },
            });

          if (duplicate) {
            throw new ConflictException(
              'Email already belongs to another user',
            );
          }
        }

        // ---------------------------------------------
        // 7. Update
        // ---------------------------------------------

        const result =
          await tx.user.updateMany({
            where: {
              id: targetUserId,
              companyId,
            },

            data: {
              ...(username !== undefined && {
                username,
              }),

              ...(email !== undefined && {
                email,
              }),

              ...(dto.roleId !== undefined && {
                roleId: dto.roleId,
              }),
            },
          });

        if (result.count !== 1) {
          throw new ConflictException(
            'User could not be updated',
          );
        }

        // ---------------------------------------------
        // 8. Read updated user
        // ---------------------------------------------

        const updated =
          await tx.user.findFirst({
            where: {
              id: targetUserId,
              companyId,
            },

            select: this.userSelect,
          });

        if (!updated) {
          throw new NotFoundException(
            'Updated user could not be found',
          );
        }

        // ---------------------------------------------
        // 9. Audit
        // ---------------------------------------------

        await tx.auditLog.create({
          data: {
            companyId,
            userId: actorId,

            module: 'users',
            action: 'UPDATE',
            recordId: targetUserId,

            oldValues: {
              username:
                existing.username,

              email:
                existing.email,

              roleId:
                existing.roleId,
            },

            newValues: {
              username:
                updated.username,

              email:
                updated.email,

              roleId:
                dto.roleId !== undefined
                  ? dto.roleId
                  : existing.roleId,
            },
          },
        });

        return updated;
      },
    );
  }

  // =====================================================
  // DEACTIVATE USER
  // =====================================================

  async deactivate(
    companyId: string,
    actorId: string,
    targetUserId: string,
  ) {
    if (targetUserId === actorId) {
      throw new ForbiddenException(
        'You cannot deactivate your own account',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const user =
          await tx.user.findFirst({
            where: {
              id: targetUserId,
              companyId,
            },

            select: {
              id: true,
              isActive: true,
            },
          });

        if (!user) {
          throw new NotFoundException(
            'User not found',
          );
        }

        if (!user.isActive) {
          throw new ConflictException(
            'User is already inactive',
          );
        }

        const result =
          await tx.user.updateMany({
            where: {
              id: targetUserId,
              companyId,
              isActive: true,
            },

            data: {
              isActive: false,
            },
          });

        if (result.count !== 1) {
          throw new ConflictException(
            'User could not be deactivated',
          );
        }

        await tx.auditLog.create({
          data: {
            companyId,
            userId: actorId,

            module: 'users',
            action: 'DEACTIVATE',
            recordId: targetUserId,

            oldValues: {
              isActive: true,
            },

            newValues: {
              isActive: false,
            },
          },
        });

        return {
          message:
            'User deactivated successfully',

          userId: targetUserId,
        };
      },
    );
  }

  // =====================================================
  // ACTIVATE USER
  // =====================================================

  async activate(
    companyId: string,
    actorId: string,
    targetUserId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const user =
          await tx.user.findFirst({
            where: {
              id: targetUserId,
              companyId,
            },

            include: {
              employee: true,
              role: true,
            },
          });

        if (!user) {
          throw new NotFoundException(
            'User not found',
          );
        }

        if (user.isActive) {
          throw new ConflictException(
            'User is already active',
          );
        }

        if (
          user.employee &&
          !user.employee.isActive
        ) {
          throw new ConflictException(
            'Cannot activate an account linked to an inactive employee',
          );
        }

        if (!user.role.isActive) {
          throw new ConflictException(
            'Cannot activate an account with an inactive role',
          );
        }

        const result =
          await tx.user.updateMany({
            where: {
              id: targetUserId,
              companyId,
              isActive: false,
            },

            data: {
              isActive: true,
            },
          });

        if (result.count !== 1) {
          throw new ConflictException(
            'User could not be activated',
          );
        }

        await tx.auditLog.create({
          data: {
            companyId,
            userId: actorId,

            module: 'users',
            action: 'ACTIVATE',
            recordId: targetUserId,

            oldValues: {
              isActive: false,
            },

            newValues: {
              isActive: true,
            },
          },
        });

        return {
          message:
            'User activated successfully',

          userId: targetUserId,
        };
      },
    );
  }

  // =====================================================
  // RESET PASSWORD
  // =====================================================

  async resetPassword(
    companyId: string,
    actorId: string,
    targetUserId: string,
    dto: ResetUserPasswordDto,
  ) {
    const passwordHash =
      await bcrypt.hash(
        dto.newPassword,
        12,
      );

    return this.prisma.$transaction(
      async (tx) => {
        const user =
          await tx.user.findFirst({
            where: {
              id: targetUserId,
              companyId,
            },

            select: {
              id: true,
            },
          });

        if (!user) {
          throw new NotFoundException(
            'User not found',
          );
        }

        const result =
          await tx.user.updateMany({
            where: {
              id: targetUserId,
              companyId,
            },

            data: {
              passwordHash,
            },
          });

        if (result.count !== 1) {
          throw new ConflictException(
            'Password could not be reset',
          );
        }

        // Never store password or hash
        // inside the audit log.
        await tx.auditLog.create({
          data: {
            companyId,
            userId: actorId,

            module: 'users',
            action: 'RESET_PASSWORD',
            recordId: targetUserId,

            newValues: {
              passwordReset: true,
            },
          },
        });

        return {
          message:
            'Password reset successfully',
        };
      },
    );
  }
}
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import { PrismaService } from '../../prisma/prisma.service.js';

import type {
  AuthenticatedRequest,
} from '../auth.types.js';

import {
  PERMISSION_KEY,
} from './require-permission.decorator.js';

import type {
  RequiredPermission,
} from './require-permission.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {

    // 1. Read the permission required by the route.
    const requiredPermission =
      this.reflector.getAllAndOverride<RequiredPermission>(
        PERMISSION_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    // 2. Reject routes without permission metadata.
    if (!requiredPermission) {
      throw new ForbiddenException(
        'Permission configuration is missing',
      );
    }

    // 3. Get the authenticated user.
    const request =
      context.switchToHttp()
        .getRequest<AuthenticatedRequest>();

    const user = request.user;

    // JwtAuthGuard must run before this guard.
    if (!user) {
      throw new UnauthorizedException(
        'Authentication required',
      );
    }

    // 4. Check the database for an assigned permission.
    const rolePermission =
      await this.prisma.rolePermission.findFirst({
        where: {
          roleId: user.role.id,

          permission: {
            is: {
              module: requiredPermission.module,
              action: requiredPermission.action,
            },
          },
        },
      });

    // 5. Reject users without the permission.
    if (!rolePermission) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    // 6. Permission granted.
    return true;
  }
}
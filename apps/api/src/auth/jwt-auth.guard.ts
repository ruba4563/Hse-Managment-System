import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  JwtService,
} from '@nestjs/jwt';

import type {
  Request,
} from 'express';

import {
  PrismaService,
} from '../prisma/prisma.service.js';

import type {
  AuthenticatedUser,
} from './auth.types.js';

// =====================================================
// JWT PAYLOAD
// =====================================================

interface JwtPayload {
  sub: string;

  username?: string;

  iat?: number;
  exp?: number;

  iss?: string;
  aud?: string;
}

// =====================================================
// REQUEST WITH AUTHENTICATED USER
// =====================================================

interface RequestWithUser
  extends Request {
  user?: AuthenticatedUser;
}

// =====================================================
// JWT AUTH GUARD
// =====================================================

@Injectable()
export class JwtAuthGuard
  implements CanActivate
{
  constructor(
    private readonly jwtService:
      JwtService,

    private readonly prisma:
      PrismaService,
  ) {}

  // ===================================================
  // CAN ACTIVATE
  // ===================================================

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request =
      context
        .switchToHttp()
        .getRequest<RequestWithUser>();

    // -------------------------------------------------
    // 1. READ TOKEN
    // -------------------------------------------------

    const token =
      this.extractBearerToken(
        request,
      );

    if (!token) {
      throw new UnauthorizedException(
        'Authentication required',
      );
    }

    // -------------------------------------------------
    // 2. VERIFY TOKEN
    // -------------------------------------------------

    let payload: JwtPayload;

    try {
      payload =
        await this.jwtService
          .verifyAsync<JwtPayload>(
            token,
            {
              issuer:
                'hse-api',

              audience:
                'hse-web',
            },
          );
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired token',
      );
    }

    if (!payload.sub) {
      throw new UnauthorizedException(
        'Invalid token payload',
      );
    }

    // -------------------------------------------------
    // 3. RELOAD USER FROM DATABASE
    //
    // IMPORTANT:
    // We intentionally reload the user on every
    // protected request.
    //
    // This means disabling an account immediately
    // invalidates an existing JWT.
    // -------------------------------------------------

    const user =
      await this.prisma.user.findFirst({
        where: {
          id:
            payload.sub,

          isActive:
            true,
        },

        include: {
          company:
            true,

          role:
            true,
        },
      });

    if (!user) {
      throw new UnauthorizedException(
        'Account is inactive or unavailable',
      );
    }

    // -------------------------------------------------
    // 4. COMPANY MUST STILL BE ACTIVE
    // -------------------------------------------------

    if (!user.company.isActive) {
      throw new UnauthorizedException(
        'Company account is inactive',
      );
    }

    // -------------------------------------------------
    // 5. ROLE MUST STILL BE ACTIVE
    // -------------------------------------------------

    if (!user.role.isActive) {
      throw new UnauthorizedException(
        'User role is inactive',
      );
    }

    // -------------------------------------------------
    // 6. LOAD ROLE-PERMISSION IDS
    //
    // Your RolePermission table contains:
    //
    // roleId
    // permissionId
    //
    // It does NOT expose:
    //
    // rolePermission.permission
    //
    // so we load the IDs first.
    // -------------------------------------------------

    const rolePermissions =
      await this.prisma
        .rolePermission
        .findMany({
          where: {
            roleId:
              user.roleId,
          },

          select: {
            permissionId:
              true,
          },
        });

    // -------------------------------------------------
    // 7. LOAD PERMISSION RECORDS
    // -------------------------------------------------

    const permissionIds =
      rolePermissions.map(
        item =>
          item.permissionId,
      );

    const permissionRecords =
      permissionIds.length > 0
        ? await this.prisma
            .permission
            .findMany({
              where: {
                id: {
                  in:
                    permissionIds,
                },
              },

              select: {
                module:
                  true,

                action:
                  true,
              },
            })
        : [];

    // -------------------------------------------------
    // 8. CONVERT TO module:action STRINGS
    //
    // Example:
    //
    // sites:read
    // sites:create
    // users:update
    // -------------------------------------------------

    const permissions =
      permissionRecords.map(
        permission =>
          `${permission.module}:${permission.action}`,
      );

    // -------------------------------------------------
    // 9. ATTACH AUTHENTICATED USER
    // -------------------------------------------------

    request.user = {
      id:
        user.id,

      username:
        user.username,

      email:
        user.email,

      company: {
        id:
          user.company.id,

        name:
          user.company.name,
      },

      role: {
        id:
          user.role.id,

        name:
          user.role.name,
      },

      permissions,
    };

    return true;
  }

  // ===================================================
  // EXTRACT BEARER TOKEN
  // ===================================================

  private extractBearerToken(
    request: Request,
  ): string | null {
    const authorization =
      request.headers
        .authorization;

    if (!authorization) {
      return null;
    }

    const [
      type,
      token,
    ] =
      authorization.split(' ');

    if (
      type !== 'Bearer' ||
      !token
    ) {
      return null;
    }

    return token;
  }
}
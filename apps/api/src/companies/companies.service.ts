import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

import { UpdateCompanyDto } from './dto/update-company.dto.js';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // -----------------------------------
  // Get authenticated user's company
  // -----------------------------------

  async getMyCompany(companyId: string) {
    const company =
      await this.prisma.company.findFirst({
        where: {
          id: companyId,
          isActive: true,
        },

        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          phone: true,
          email: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    if (!company) {
      throw new NotFoundException(
        'Company not found',
      );
    }

    return company;
  }

  // -----------------------------------
  // Update authenticated user's company
  // -----------------------------------

  async updateMyCompany(
    companyId: string,
    userId: string,
    dto: UpdateCompanyDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findFirst({
        where: {
          id: companyId,
          isActive: true,
        },
      });

      if (!company) {
        throw new NotFoundException(
          'Company not found',
        );
      }

      const updatedCompany = await tx.company.update({
        where: {
          id: companyId,
        },

        data: {
          ...(dto.name !== undefined && {
            name: dto.name.trim(),
          }),

          ...(dto.address !== undefined && {
            address: dto.address.trim(),
          }),

          ...(dto.phone !== undefined && {
            phone: dto.phone.trim(),
          }),

          ...(dto.email !== undefined && {
            email: dto.email.trim(),
          }),
        },

        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          phone: true,
          email: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Record the change in the audit log.
      await tx.auditLog.create({
        data: {
          companyId,
          userId,

          module: 'companies',
          action: 'UPDATE',

          recordId: companyId,

          oldValues: {
            name: company.name,
            address: company.address,
            phone: company.phone,
            email: company.email,
          },

          newValues: {
            name: updatedCompany.name,
            address: updatedCompany.address,
            phone: updatedCompany.phone,
            email: updatedCompany.email,
          },
        },
      });

      return updatedCompany;
    });
  }
}
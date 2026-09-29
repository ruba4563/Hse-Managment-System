import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PermitApprovalDecision,
  PermitStatus,
} from '../generated/prisma/client.js';

import {
  PrismaService,
} from '../prisma/prisma.service.js';

import {
  CreatePermitDto,
} from './dto/create-permit.dto.js';

import {
  UpdatePermitDto,
} from './dto/update-permit.dto.js';
import {
  CreatePermitChecklistItemDto,
} from './dto/create-permit-checklist-item.dto.js';

import {
  UpdatePermitChecklistItemDto,
} from './dto/update-permit-checklist-item.dto.js';

// =====================================================
// RAW LOCK TYPES
// =====================================================

type LockedProject = {
  id: string;
  companyId: string;
  isActive: boolean;
};

type LockedSite = {
  id: string;
  projectId: string;
  isActive: boolean;
};

type LockedPermit = {
  id: string;
};

// =====================================================
// SERVICE
// =====================================================

@Injectable()
export class PermitsService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  // ===================================================
  // COMMON SELECT
  // ===================================================

  private readonly permitSelect = {
    id: true,

    permitNumber: true,

    permitTypeId: true,
    projectId: true,
    siteId: true,
    requestedById: true,

    location: true,
    contractorDepartment: true,

    requiredPpe: true,
    hazards: true,
    controlMeasures: true,

    startDateTime: true,
    endDateTime: true,

    status: true,

    description: true,

    submittedAt: true,

    approvedAt: true,
    approvedById: true,

    rejectedAt: true,
    rejectedById: true,
    rejectionReason: true,

    activatedAt: true,

    closedAt: true,
    closedById: true,

    createdAt: true,
    updatedAt: true,

    permitType: {
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
      },
    },

    project: {
      select: {
        id: true,
        name: true,
        code: true,
        clientName: true,
        isActive: true,
      },
    },

    site: {
      select: {
        id: true,
        name: true,
        code: true,
        location: true,
        isActive: true,
      },
    },

    requestedBy: {
      select: {
        id: true,
        username: true,
        email: true,

        employee: {
          select: {
            id: true,
            employeeNumber: true,
            fullName: true,
            jobTitle: true,
          },
        },
      },
    },

    approvedBy: {
      select: {
        id: true,
        username: true,
      },
    },

    rejectedBy: {
      select: {
        id: true,
        username: true,
      },
    },

    closedBy: {
      select: {
        id: true,
        username: true,
      },
    },
  } as const;

  // ===================================================
  // PERMIT TYPES
  // ===================================================

  async findPermitTypes() {
    return this.prisma.permitType.findMany({
      where: {
        isActive: true,
      },

      orderBy: {
        name: 'asc',
      },

      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
      },
    });
  }

  // ===================================================
  // LIST
  // ===================================================

  async findAll(
    companyId: string,
    userId: string,
    roleName: string,
  ) {
    return this.prisma.permit.findMany({
      where: {
        project: {
          companyId,
        },

        ...(
          roleName !== 'SUPER_ADMIN'
            ? {
                site: {
                  userAccess: {
                    some: {
                      userId,
                    },
                  },
                },
              }
            : {}
        ),
      },

      orderBy: {
        createdAt: 'desc',
      },

      select:
        this.permitSelect,
    });
  }

  // ===================================================
  // FIND ONE
  // ===================================================

  async findOne(
    permitId: string,
    companyId: string,
    userId: string,
    roleName: string,
  ) {
    const permit =
      await this.prisma.permit.findFirst({
        where: {
          id:
            permitId,

          project: {
            companyId,
          },

          ...(
            roleName !== 'SUPER_ADMIN'
              ? {
                  site: {
                    userAccess: {
                      some: {
                        userId,
                      },
                    },
                  },
                }
              : {}
          ),
        },

        select:
          this.permitSelect,
      });

    if (!permit) {
      throw new NotFoundException(
        'Permit not found',
      );
    }

    return permit;
  }


    // ===================================================
  // GET CHECKLIST
  // ===================================================

  async getChecklist(
    permitId: string,
    companyId: string,
    actorId: string,
    roleName: string,
  ) {
    await this.findOne(
      permitId,
      companyId,
      actorId,
      roleName,
    );

    return this.prisma.permitChecklistItem.findMany({
      where: {
        permitId,
      },

      orderBy: [
        {
          displayOrder: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],

      select: {
        id: true,
        permitId: true,
        itemText: true,
        isMandatory: true,
        isCompleted: true,
        displayOrder: true,
        completedAt: true,
        completedById: true,
        createdAt: true,
        updatedAt: true,

        completedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });
  }

  // ===================================================
  // CREATE CHECKLIST ITEM
  // ===================================================

  async createChecklistItem(
    permitId: string,
    companyId: string,
    actorId: string,
    roleName: string,
    dto: CreatePermitChecklistItemDto,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(
      async tx => {
        await this.lockPermit(
          tx,
          permitId,
        );

        const permit =
          await this.getScopedPermitForMutation(
            tx,
            permitId,
            companyId,
            actorId,
            roleName,
          );

        if (
          permit.status !==
          PermitStatus.DRAFT
        ) {
          throw new ConflictException(
            'Checklist structure can only be changed while the permit is in DRAFT status',
          );
        }

        const item =
          await tx.permitChecklistItem.create({
            data: {
              permitId,

              itemText:
                dto.itemText.trim(),

              isMandatory:
                dto.isMandatory ??
                true,

              displayOrder:
                dto.displayOrder ??
                0,
            },

            select: {
              id: true,
              permitId: true,
              itemText: true,
              isMandatory: true,
              isCompleted: true,
              displayOrder: true,
              completedAt: true,
              completedById: true,
              createdAt: true,
              updatedAt: true,
            },
          });

        await tx.auditLog.create({
          data: {
            companyId,

            userId:
              actorId,

            module:
              'permits',

            action:
              'CHECKLIST_CREATE',

            recordId:
              permitId,

            newValues: {
              checklistItemId:
                item.id,

              itemText:
                item.itemText,

              isMandatory:
                item.isMandatory,

              displayOrder:
                item.displayOrder,
            },

            ipAddress:
              ipAddress ??
              null,
          },
        });

        return item;
      },
    );
  }

  // ===================================================
  // UPDATE CHECKLIST ITEM
  // ===================================================

  async updateChecklistItem(
    permitId: string,
    itemId: string,
    companyId: string,
    actorId: string,
    roleName: string,
    dto: UpdatePermitChecklistItemDto,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(
      async tx => {
        await this.lockPermit(
          tx,
          permitId,
        );

        const permit =
          await this.getScopedPermitForMutation(
            tx,
            permitId,
            companyId,
            actorId,
            roleName,
          );

        if (
          permit.status !==
            PermitStatus.DRAFT &&
          permit.status !==
            PermitStatus.PENDING_APPROVAL
        ) {
          throw new ConflictException(
            'Checklist items can only be updated while the permit is DRAFT or PENDING_APPROVAL',
          );
        }

        const existing =
          await tx.permitChecklistItem.findFirst({
            where: {
              id:
                itemId,

              permitId,
            },

            select: {
              id: true,
              itemText: true,
              isMandatory: true,
              isCompleted: true,
              displayOrder: true,
              completedAt: true,
              completedById: true,
            },
          });

        if (!existing) {
          throw new NotFoundException(
            'Checklist item not found',
          );
        }

        // Once submitted, only completion state can change.
        if (
          permit.status ===
          PermitStatus.PENDING_APPROVAL &&
          (
            dto.itemText !== undefined ||
            dto.isMandatory !== undefined ||
            dto.displayOrder !== undefined
          )
        ) {
          throw new ConflictException(
            'After submission, only checklist completion status can be changed',
          );
        }

        let completedAt =
          existing.completedAt;

        let completedById =
          existing.completedById;

        if (
          dto.isCompleted !==
          undefined
        ) {
          if (dto.isCompleted) {
            completedAt =
              new Date();

            completedById =
              actorId;
          } else {
            completedAt =
              null;

            completedById =
              null;
          }
        }

        const updated =
          await tx.permitChecklistItem.update({
            where: {
              id:
                itemId,
            },

            data: {
              ...(
                dto.itemText !==
                undefined
                  ? {
                      itemText:
                        dto.itemText.trim(),
                    }
                  : {}
              ),

              ...(
                dto.isMandatory !==
                undefined
                  ? {
                      isMandatory:
                        dto.isMandatory,
                    }
                  : {}
              ),

              ...(
                dto.displayOrder !==
                undefined
                  ? {
                      displayOrder:
                        dto.displayOrder,
                    }
                  : {}
              ),

              ...(
                dto.isCompleted !==
                undefined
                  ? {
                      isCompleted:
                        dto.isCompleted,

                      completedAt,

                      completedById,
                    }
                  : {}
              ),
            },

            select: {
              id: true,
              permitId: true,
              itemText: true,
              isMandatory: true,
              isCompleted: true,
              displayOrder: true,
              completedAt: true,
              completedById: true,
              createdAt: true,
              updatedAt: true,

              completedBy: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          });

        await tx.auditLog.create({
          data: {
            companyId,

            userId:
              actorId,

            module:
              'permits',

            action:
              'CHECKLIST_UPDATE',

            recordId:
              permitId,

            oldValues: {
              checklistItemId:
                existing.id,

              itemText:
                existing.itemText,

              isMandatory:
                existing.isMandatory,

              isCompleted:
                existing.isCompleted,

              displayOrder:
                existing.displayOrder,

              completedAt:
                existing.completedAt
                  ?.toISOString() ??
                null,

              completedById:
                existing.completedById,
            },

            newValues: {
              checklistItemId:
                updated.id,

              itemText:
                updated.itemText,

              isMandatory:
                updated.isMandatory,

              isCompleted:
                updated.isCompleted,

              displayOrder:
                updated.displayOrder,

              completedAt:
                updated.completedAt
                  ?.toISOString() ??
                null,

              completedById:
                updated.completedById,
            },

            ipAddress:
              ipAddress ??
              null,
          },
        });

        return updated;
      },
    );
  }

  // ===================================================
  // REMOVE CHECKLIST ITEM
  // ===================================================

  async removeChecklistItem(
    permitId: string,
    itemId: string,
    companyId: string,
    actorId: string,
    roleName: string,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(
      async tx => {
        await this.lockPermit(
          tx,
          permitId,
        );

        const permit =
          await this.getScopedPermitForMutation(
            tx,
            permitId,
            companyId,
            actorId,
            roleName,
          );

        if (
          permit.status !==
          PermitStatus.DRAFT
        ) {
          throw new ConflictException(
            'Checklist items can only be deleted while the permit is in DRAFT status',
          );
        }

        const existing =
          await tx.permitChecklistItem.findFirst({
            where: {
              id:
                itemId,

              permitId,
            },

            select: {
              id: true,
              itemText: true,
              isMandatory: true,
              isCompleted: true,
              displayOrder: true,
            },
          });

        if (!existing) {
          throw new NotFoundException(
            'Checklist item not found',
          );
        }

        await tx.permitChecklistItem.delete({
          where: {
            id:
              itemId,
          },
        });

        await tx.auditLog.create({
          data: {
            companyId,

            userId:
              actorId,

            module:
              'permits',

            action:
              'CHECKLIST_DELETE',

            recordId:
              permitId,

            oldValues: {
              checklistItemId:
                existing.id,

              itemText:
                existing.itemText,

              isMandatory:
                existing.isMandatory,

              isCompleted:
                existing.isCompleted,

              displayOrder:
                existing.displayOrder,
            },

            ipAddress:
              ipAddress ??
              null,
          },
        });

        return {
          success: true,
        };
      },
    );
  }

  // ===================================================
  // APPROVAL HISTORY
  // ===================================================

  async getApprovals(
    permitId: string,
    companyId: string,
    actorId: string,
    roleName: string,
  ) {
    await this.findOne(
      permitId,
      companyId,
      actorId,
      roleName,
    );

    return this.prisma.permitApproval.findMany({
      where: {
        permitId,
      },

      orderBy: {
        approvalDate:
          'asc',
      },

      select: {
        id: true,
        permitId: true,
        approverId: true,
        decision: true,
        comments: true,
        approvalDate: true,
        createdAt: true,

        approver: {
          select: {
            id: true,
            username: true,
            email: true,

            employee: {
              select: {
                fullName: true,
                jobTitle: true,
              },
            },
          },
        },
      },
    });
  }
  // ===================================================
  // CREATE
  // ===================================================

  async create(
    companyId: string,
    actorId: string,
    roleName: string,
    dto: CreatePermitDto,
    ipAddress?: string,
  ) {
    const startDateTime =
      this.parseDate(
        dto.startDateTime,
        'startDateTime',
      );

    const endDateTime =
      this.parseDate(
        dto.endDateTime,
        'endDateTime',
      );

    this.validateDateRange(
      startDateTime,
      endDateTime,
    );

    try {
      return await this.prisma.$transaction(
        async tx => {
          // ===========================================
          // LOCK PROJECT
          // ===========================================

          const project =
            await this.lockProject(
              tx,
              dto.projectId,
            );

          if (
            !project ||
            project.companyId !==
              companyId
          ) {
            throw new NotFoundException(
              'Project not found',
            );
          }

          if (!project.isActive) {
            throw new BadRequestException(
              'Cannot create a permit under an inactive project',
            );
          }

          // ===========================================
          // LOCK SITE
          // ===========================================

          const site =
            await this.lockSite(
              tx,
              dto.siteId,
            );

          if (
            !site ||
            site.projectId !==
              dto.projectId
          ) {
            throw new NotFoundException(
              'Site not found for the selected project',
            );
          }

          if (!site.isActive) {
            throw new BadRequestException(
              'Cannot create a permit for an inactive site',
            );
          }

          // ===========================================
          // SITE ACCESS
          // ===========================================

          await this.assertSiteAccess(
            tx,
            actorId,
            roleName,
            dto.siteId,
          );

          // ===========================================
          // PERMIT TYPE
          // ===========================================

          const permitType =
            await tx.permitType.findFirst({
              where: {
                id:
                  dto.permitTypeId,

                isActive:
                  true,
              },

              select: {
                id: true,
              },
            });

          if (!permitType) {
            throw new BadRequestException(
              'Invalid or inactive permit type',
            );
          }

          // ===========================================
          // GENERATE NUMBER
          // ===========================================

          const permitNumber =
            await this.generatePermitNumber(
              tx,
              startDateTime,
            );

          // ===========================================
          // CREATE PERMIT
          // ===========================================

          const permit =
            await tx.permit.create({
              data: {
                permitNumber,

                permitTypeId:
                  dto.permitTypeId,

                projectId:
                  dto.projectId,

                siteId:
                  dto.siteId,

                requestedById:
                  actorId,

                location:
                  this.cleanOptionalString(
                    dto.location,
                  ),

                contractorDepartment:
                  this.cleanOptionalString(
                    dto.contractorDepartment,
                  ),

                requiredPpe:
                  this.cleanStringArray(
                    dto.requiredPpe,
                  ),

                hazards:
                  this.cleanStringArray(
                    dto.hazards,
                  ),

                controlMeasures:
                  this.cleanStringArray(
                    dto.controlMeasures,
                  ),

                startDateTime,

                endDateTime,

                description:
                  dto.description.trim(),

                status:
                  PermitStatus.DRAFT,
              },

              select:
                this.permitSelect,
            });

          // ===========================================
          // AUDIT
          // ===========================================

          await tx.auditLog.create({
            data: {
              companyId,

              userId:
                actorId,

              module:
                'permits',

              action:
                'CREATE',

              recordId:
                permit.id,

              newValues: {
                permitNumber:
                  permit.permitNumber,

                permitTypeId:
                  permit.permitTypeId,

                projectId:
                  permit.projectId,

                siteId:
                  permit.siteId,

                requestedById:
                  permit.requestedById,

                location:
                  permit.location,

                contractorDepartment:
                  permit.contractorDepartment,

                requiredPpe:
                  permit.requiredPpe,

                hazards:
                  permit.hazards,

                controlMeasures:
                  permit.controlMeasures,

                startDateTime:
                  permit.startDateTime
                    .toISOString(),

                endDateTime:
                  permit.endDateTime
                    .toISOString(),

                status:
                  permit.status,
              },

              ipAddress:
                ipAddress ??
                null,
            },
          });

          return permit;
        },
      );
    } catch (error) {
      if (
        this.isPrismaError(
          error,
          'P2002',
        )
      ) {
        throw new ConflictException(
          'Permit number conflict. Please retry.',
        );
      }

      throw error;
    }
  }

  // ===================================================
  // UPDATE DRAFT
  // ===================================================

  async update(
    permitId: string,
    companyId: string,
    actorId: string,
    roleName: string,
    dto: UpdatePermitDto,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(
      async tx => {
        // =============================================
        // LOCK PERMIT
        // =============================================

        await this.lockPermit(
          tx,
          permitId,
        );

        // =============================================
        // LOAD SCOPED PERMIT
        // =============================================

        const existing =
          await this.getScopedPermitForMutation(
            tx,
            permitId,
            companyId,
            actorId,
            roleName,
          );

        if (
          existing.status !==
          PermitStatus.DRAFT
        ) {
          throw new ConflictException(
            'Only draft permits can be edited',
          );
        }

        const targetProjectId =
          dto.projectId ??
          existing.projectId;

        const targetSiteId =
          dto.siteId ??
          existing.siteId;

        const targetPermitTypeId =
          dto.permitTypeId ??
          existing.permitTypeId;

        // =============================================
        // PROJECT
        // =============================================

        const project =
          await this.lockProject(
            tx,
            targetProjectId,
          );

        if (
          !project ||
          project.companyId !==
            companyId
        ) {
          throw new NotFoundException(
            'Project not found',
          );
        }

        if (!project.isActive) {
          throw new BadRequestException(
            'Cannot move or edit a permit under an inactive project',
          );
        }

        // =============================================
        // SITE
        // =============================================

        const site =
          await this.lockSite(
            tx,
            targetSiteId,
          );

        if (
          !site ||
          site.projectId !==
            targetProjectId
        ) {
          throw new NotFoundException(
            'Site not found for the selected project',
          );
        }

        if (!site.isActive) {
          throw new BadRequestException(
            'Cannot use an inactive site',
          );
        }

        // =============================================
        // SITE ACCESS
        // =============================================

        await this.assertSiteAccess(
          tx,
          actorId,
          roleName,
          targetSiteId,
        );

        // =============================================
        // PERMIT TYPE
        // =============================================

        const permitType =
          await tx.permitType.findFirst({
            where: {
              id:
                targetPermitTypeId,

              isActive:
                true,
            },

            select: {
              id: true,
            },
          });

        if (!permitType) {
          throw new BadRequestException(
            'Invalid or inactive permit type',
          );
        }

        // =============================================
        // DATE VALIDATION
        // =============================================

        const startDateTime =
          dto.startDateTime
            ? this.parseDate(
                dto.startDateTime,
                'startDateTime',
              )
            : existing.startDateTime;

        const endDateTime =
          dto.endDateTime
            ? this.parseDate(
                dto.endDateTime,
                'endDateTime',
              )
            : existing.endDateTime;

        this.validateDateRange(
          startDateTime,
          endDateTime,
        );

        // =============================================
        // UPDATE
        // =============================================

        const result =
          await tx.permit.updateMany({
            where: {
              id:
                permitId,

              status:
                PermitStatus.DRAFT,
            },

            data: {
              permitTypeId:
                targetPermitTypeId,

              projectId:
                targetProjectId,

              siteId:
                targetSiteId,

              startDateTime,

              endDateTime,

              ...(
                dto.location !==
                undefined
                  ? {
                      location:
                        this.cleanOptionalString(
                          dto.location,
                        ),
                    }
                  : {}
              ),

              ...(
                dto.contractorDepartment !==
                undefined
                  ? {
                      contractorDepartment:
                        this.cleanOptionalString(
                          dto.contractorDepartment,
                        ),
                    }
                  : {}
              ),

              ...(
                dto.requiredPpe !==
                undefined
                  ? {
                      requiredPpe:
                        this.cleanStringArray(
                          dto.requiredPpe,
                        ),
                    }
                  : {}
              ),

              ...(
                dto.hazards !==
                undefined
                  ? {
                      hazards:
                        this.cleanStringArray(
                          dto.hazards,
                        ),
                    }
                  : {}
              ),

              ...(
                dto.controlMeasures !==
                undefined
                  ? {
                      controlMeasures:
                        this.cleanStringArray(
                          dto.controlMeasures,
                        ),
                    }
                  : {}
              ),

              ...(
                dto.description !==
                undefined
                  ? {
                      description:
                        dto.description.trim(),
                    }
                  : {}
              ),
            },
          });

        if (
          result.count !==
          1
        ) {
          throw new ConflictException(
            'Permit could not be updated because its status changed',
          );
        }

        const updated =
          await this.getPermitAfterMutation(
            tx,
            permitId,
          );

        // =============================================
        // AUDIT
        // =============================================

        await tx.auditLog.create({
          data: {
            companyId,

            userId:
              actorId,

            module:
              'permits',

            action:
              'UPDATE',

            recordId:
              permitId,

            oldValues:
              this.auditSnapshot(
                existing,
              ),

            newValues:
              this.auditSnapshot(
                updated,
              ),

            ipAddress:
              ipAddress ??
                null,
          },
        });

        return updated;
      },
    );
  }

  // ===================================================
  // SUBMIT
  // DRAFT -> PENDING_APPROVAL
  // ===================================================

  async submit(
    permitId: string,
    companyId: string,
    actorId: string,
    roleName: string,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(
      async tx => {
        await this.lockPermit(
          tx,
          permitId,
        );

        const permit =
          await this.getScopedPermitForMutation(
            tx,
            permitId,
            companyId,
            actorId,
            roleName,
          );

        if (
          permit.status !==
          PermitStatus.DRAFT
        ) {
          throw new ConflictException(
            'Only draft permits can be submitted',
          );
        }

        await this.validatePermitForSubmission(
          tx,
          permit,
          companyId,
          actorId,
          roleName,
        );

        const now =
          new Date();

        const result =
          await tx.permit.updateMany({
            where: {
              id:
                permitId,

              status:
                PermitStatus.DRAFT,
            },

            data: {
              status:
                PermitStatus.PENDING_APPROVAL,

              submittedAt:
                now,

              rejectedAt:
                null,

              rejectedById:
                null,

              rejectionReason:
                null,
            },
          });

        if (
          result.count !==
          1
        ) {
          throw new ConflictException(
            'Permit status changed before submission completed',
          );
        }

        const updated =
          await this.getPermitAfterMutation(
            tx,
            permitId,
          );

        await this.createWorkflowAudit(
          tx,
          companyId,
          actorId,
          permitId,
          'SUBMIT',
          permit.status,
          updated.status,
          ipAddress,
          {
            submittedAt:
              updated.submittedAt
                ?.toISOString() ??
              null,
          },
        );

        return updated;
      },
    );
  }

  // ===================================================
  // APPROVE
  // PENDING_APPROVAL -> APPROVED
  // ===================================================

   async approve(
    permitId: string,
    companyId: string,
    actorId: string,
    roleName: string,
    comments?: string,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(
      async tx => {
        await this.lockPermit(
          tx,
          permitId,
        );

        const permit =
          await this.getScopedPermitForMutation(
            tx,
            permitId,
            companyId,
            actorId,
            roleName,
          );

        if (
          permit.status !==
          PermitStatus.PENDING_APPROVAL
        ) {
          throw new ConflictException(
            'Only permits pending approval can be approved',
          );
        }

        await this.assertOperationalContext(
          tx,
          permit,
          companyId,
          actorId,
          roleName,
        );

        // =============================================
        // MANDATORY CHECKLIST ENFORCEMENT
        // =============================================

        const incompleteMandatoryCount =
          await tx.permitChecklistItem.count({
            where: {
              permitId,

              isMandatory:
                true,

              isCompleted:
                false,
            },
          });

        if (
          incompleteMandatoryCount >
          0
        ) {
          throw new BadRequestException(
            `Permit cannot be approved. ${incompleteMandatoryCount} mandatory checklist item(s) are incomplete.`,
          );
        }

        const now =
          new Date();

        const cleanedComments =
          comments
            ?.trim() ||
          null;

        const result =
          await tx.permit.updateMany({
            where: {
              id:
                permitId,

              status:
                PermitStatus.PENDING_APPROVAL,
            },

            data: {
              status:
                PermitStatus.APPROVED,

              approvedAt:
                now,

              approvedById:
                actorId,

              rejectedAt:
                null,

              rejectedById:
                null,

              rejectionReason:
                null,
            },
          });

        if (
          result.count !==
          1
        ) {
          throw new ConflictException(
            'Permit status changed before approval completed',
          );
        }

        // =============================================
        // APPROVAL HISTORY
        // =============================================

        await tx.permitApproval.create({
          data: {
            permitId,

            approverId:
              actorId,

            decision:
              PermitApprovalDecision.APPROVED,

            comments:
              cleanedComments,

            approvalDate:
              now,
          },
        });

        const updated =
          await this.getPermitAfterMutation(
            tx,
            permitId,
          );

        await this.createWorkflowAudit(
          tx,
          companyId,
          actorId,
          permitId,
          'APPROVE',
          permit.status,
          updated.status,
          ipAddress,
          {
            approvedById:
              actorId,

            approvedAt:
              updated.approvedAt
                ?.toISOString() ??
              null,

            comments:
              cleanedComments,
          },
        );

        return updated;
      },
    );
  }

  // ===================================================
  // REJECT
  // PENDING_APPROVAL -> REJECTED
  // ===================================================

    async reject(
    permitId: string,
    companyId: string,
    actorId: string,
    roleName: string,
    reason: string,
    ipAddress?: string,
  ) {
    const cleanedReason =
      reason.trim();

    if (
      cleanedReason.length <
      3
    ) {
      throw new BadRequestException(
        'Rejection reason is required',
      );
    }

    return this.prisma.$transaction(
      async tx => {
        await this.lockPermit(
          tx,
          permitId,
        );

        const permit =
          await this.getScopedPermitForMutation(
            tx,
            permitId,
            companyId,
            actorId,
            roleName,
          );

        if (
          permit.status !==
          PermitStatus.PENDING_APPROVAL
        ) {
          throw new ConflictException(
            'Only permits pending approval can be rejected',
          );
        }

        await this.assertOperationalContext(
          tx,
          permit,
          companyId,
          actorId,
          roleName,
        );

        const now =
          new Date();

        const result =
          await tx.permit.updateMany({
            where: {
              id:
                permitId,

              status:
                PermitStatus.PENDING_APPROVAL,
            },

            data: {
              status:
                PermitStatus.REJECTED,

              rejectedAt:
                now,

              rejectedById:
                actorId,

              rejectionReason:
                cleanedReason,

              approvedAt:
                null,

              approvedById:
                null,
            },
          });

        if (
          result.count !==
          1
        ) {
          throw new ConflictException(
            'Permit status changed before rejection completed',
          );
        }

        // =============================================
        // APPROVAL HISTORY
        // =============================================

        await tx.permitApproval.create({
          data: {
            permitId,

            approverId:
              actorId,

            decision:
              PermitApprovalDecision.REJECTED,

            comments:
              cleanedReason,

            approvalDate:
              now,
          },
        });

        const updated =
          await this.getPermitAfterMutation(
            tx,
            permitId,
          );

        await this.createWorkflowAudit(
          tx,
          companyId,
          actorId,
          permitId,
          'REJECT',
          permit.status,
          updated.status,
          ipAddress,
          {
            rejectedById:
              actorId,

            rejectedAt:
              updated.rejectedAt
                ?.toISOString() ??
              null,

            rejectionReason:
              cleanedReason,
          },
        );

        return updated;
      },
    );
  }

  // ===================================================
  // ACTIVATE
  // APPROVED -> ACTIVE
  // ===================================================

  async activate(
    permitId: string,
    companyId: string,
    actorId: string,
    roleName: string,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(
      async tx => {
        await this.lockPermit(
          tx,
          permitId,
        );

        const permit =
          await this.getScopedPermitForMutation(
            tx,
            permitId,
            companyId,
            actorId,
            roleName,
          );

        if (
          permit.status !==
          PermitStatus.APPROVED
        ) {
          throw new ConflictException(
            'Only approved permits can be activated',
          );
        }

        await this.assertOperationalContext(
          tx,
          permit,
          companyId,
          actorId,
          roleName,
        );

        const now =
          new Date();

        if (
          permit.endDateTime
            .getTime() <=
          now.getTime()
        ) {
          throw new BadRequestException(
            'Expired permits cannot be activated',
          );
        }

        const result =
          await tx.permit.updateMany({
            where: {
              id:
                permitId,

              status:
                PermitStatus.APPROVED,
            },

            data: {
              status:
                PermitStatus.ACTIVE,

              activatedAt:
                now,
            },
          });

        if (
          result.count !==
          1
        ) {
          throw new ConflictException(
            'Permit status changed before activation completed',
          );
        }

        const updated =
          await this.getPermitAfterMutation(
            tx,
            permitId,
          );

        await this.createWorkflowAudit(
          tx,
          companyId,
          actorId,
          permitId,
          'ACTIVATE',
          permit.status,
          updated.status,
          ipAddress,
          {
            activatedAt:
              updated.activatedAt
                ?.toISOString() ??
              null,
          },
        );

        return updated;
      },
    );
  }

  // ===================================================
  // CLOSE
  // ACTIVE -> CLOSED
  // ===================================================

  async close(
    permitId: string,
    companyId: string,
    actorId: string,
    roleName: string,
    ipAddress?: string,
  ) {
    return this.prisma.$transaction(
      async tx => {
        await this.lockPermit(
          tx,
          permitId,
        );

        const permit =
          await this.getScopedPermitForMutation(
            tx,
            permitId,
            companyId,
            actorId,
            roleName,
          );

        if (
          permit.status !==
          PermitStatus.ACTIVE
        ) {
          throw new ConflictException(
            'Only active permits can be closed',
          );
        }

        const now =
          new Date();

        const result =
          await tx.permit.updateMany({
            where: {
              id:
                permitId,

              status:
                PermitStatus.ACTIVE,
            },

            data: {
              status:
                PermitStatus.CLOSED,

              closedAt:
                now,

              closedById:
                actorId,
            },
          });

        if (
          result.count !==
          1
        ) {
          throw new ConflictException(
            'Permit status changed before closure completed',
          );
        }

        const updated =
          await this.getPermitAfterMutation(
            tx,
            permitId,
          );

        await this.createWorkflowAudit(
          tx,
          companyId,
          actorId,
          permitId,
          'CLOSE',
          permit.status,
          updated.status,
          ipAddress,
          {
            closedById:
              actorId,

            closedAt:
              updated.closedAt
                ?.toISOString() ??
              null,
          },
        );

        return updated;
      },
    );
  }

  // ===================================================
  // SUBMISSION VALIDATION
  // ===================================================

  private async validatePermitForSubmission(
    tx: any,
    permit: any,
    companyId: string,
    actorId: string,
    roleName: string,
  ) {
    const missing:
      string[] = [];

    if (
      !permit.description ||
      permit.description
        .trim()
        .length <
        3
    ) {
      missing.push(
        'description',
      );
    }

    if (
      !permit.location ||
      permit.location
        .trim()
        .length ===
        0
    ) {
      missing.push(
        'location',
      );
    }

    if (
      !permit.contractorDepartment ||
      permit.contractorDepartment
        .trim()
        .length ===
        0
    ) {
      missing.push(
        'contractorDepartment',
      );
    }

    if (
      permit.requiredPpe
        .length ===
      0
    ) {
      missing.push(
        'requiredPpe',
      );
    }

    if (
      permit.hazards
        .length ===
      0
    ) {
      missing.push(
        'hazards',
      );
    }

    if (
      permit.controlMeasures
        .length ===
      0
    ) {
      missing.push(
        'controlMeasures',
      );
    }

    if (
      missing.length >
      0
    ) {
      throw new BadRequestException(
        `Permit cannot be submitted. Missing required fields: ${missing.join(', ')}`,
      );
    }

    this.validateDateRange(
      permit.startDateTime,
      permit.endDateTime,
    );

    await this.assertOperationalContext(
      tx,
      permit,
      companyId,
      actorId,
      roleName,
    );
  }

  // ===================================================
  // OPERATIONAL CONTEXT
  // ===================================================

  private async assertOperationalContext(
    tx: any,
    permit: any,
    companyId: string,
    actorId: string,
    roleName: string,
  ) {
    // ================================================
    // PROJECT
    // ================================================

    const project =
      await this.lockProject(
        tx,
        permit.projectId,
      );

    if (
      !project ||
      project.companyId !==
        companyId
    ) {
      throw new NotFoundException(
        'Project not found',
      );
    }

    if (!project.isActive) {
      throw new BadRequestException(
        'Permit project is inactive',
      );
    }

    // ================================================
    // SITE
    // ================================================

    const site =
      await this.lockSite(
        tx,
        permit.siteId,
      );

    if (
      !site ||
      site.projectId !==
        permit.projectId
    ) {
      throw new NotFoundException(
        'Permit site not found',
      );
    }

    if (!site.isActive) {
      throw new BadRequestException(
        'Permit site is inactive',
      );
    }

    // ================================================
    // ACCESS
    // ================================================

    await this.assertSiteAccess(
      tx,
      actorId,
      roleName,
      permit.siteId,
    );

    // ================================================
    // TYPE
    // ================================================

    const permitType =
      await tx.permitType.findFirst({
        where: {
          id:
            permit.permitTypeId,

          isActive:
            true,
        },

        select: {
          id: true,
        },
      });

    if (!permitType) {
      throw new BadRequestException(
        'Permit type is inactive or unavailable',
      );
    }
  }

  // ===================================================
  // SCOPED PERMIT FOR MUTATIONS
  // ===================================================

  private async getScopedPermitForMutation(
    tx: any,
    permitId: string,
    companyId: string,
    actorId: string,
    roleName: string,
  ) {
    const permit =
      await tx.permit.findFirst({
        where: {
          id:
            permitId,

          project: {
            companyId,
          },

          ...(
            roleName !== 'SUPER_ADMIN'
              ? {
                  site: {
                    userAccess: {
                      some: {
                        userId:
                          actorId,
                      },
                    },
                  },
                }
              : {}
          ),
        },

        select: {
          id: true,

          permitNumber: true,

          permitTypeId: true,
          projectId: true,
          siteId: true,
          requestedById: true,

          location: true,
          contractorDepartment: true,

          requiredPpe: true,
          hazards: true,
          controlMeasures: true,

          startDateTime: true,
          endDateTime: true,

          status: true,

          description: true,

          submittedAt: true,

          approvedAt: true,
          approvedById: true,

          rejectedAt: true,
          rejectedById: true,
          rejectionReason: true,

          activatedAt: true,

          closedAt: true,
          closedById: true,

          createdAt: true,
          updatedAt: true,
        },
      });

    if (!permit) {
      throw new NotFoundException(
        'Permit not found',
      );
    }

    return permit;
  }

  // ===================================================
  // GET PERMIT AFTER MUTATION
  // ===================================================

  private async getPermitAfterMutation(
    tx: any,
    permitId: string,
  ) {
    const permit =
      await tx.permit.findUnique({
        where: {
          id:
            permitId,
        },

        select:
          this.permitSelect,
      });

    if (!permit) {
      throw new NotFoundException(
        'Permit not found',
      );
    }

    return permit;
  }

  // ===================================================
  // LOCK PERMIT
  // ===================================================

  private async lockPermit(
    tx: any,
    permitId: string,
  ) {
    const rows =
      await tx.$queryRaw<
        LockedPermit[]
      >`
        SELECT id
        FROM permits
        WHERE id = CAST(${permitId} AS uuid)
        FOR UPDATE
      `;

    if (
      rows.length ===
      0
    ) {
      throw new NotFoundException(
        'Permit not found',
      );
    }

    return rows[0];
  }

  // ===================================================
  // LOCK PROJECT
  // ===================================================

  private async lockProject(
    tx: any,
    projectId: string,
  ) {
    const rows =
      await tx.$queryRaw<
        LockedProject[]
      >`
        SELECT
          id,
          "companyId",
          "isActive"
        FROM projects
        WHERE id = CAST(${projectId} AS uuid)
        FOR UPDATE
      `;

    return (
      rows[0] ??
      null
    );
  }

  // ===================================================
  // LOCK SITE
  // ===================================================

  private async lockSite(
    tx: any,
    siteId: string,
  ) {
    const rows =
      await tx.$queryRaw<
        LockedSite[]
      >`
        SELECT
          id,
          "projectId",
          "isActive"
        FROM sites
        WHERE id = CAST(${siteId} AS uuid)
        FOR UPDATE
      `;

    return (
      rows[0] ??
      null
    );
  }

  // ===================================================
  // SITE ACCESS
  // ===================================================

  private async assertSiteAccess(
    tx: any,
    actorId: string,
    roleName: string,
    siteId: string,
  ) {
    if (
      roleName ===
      'SUPER_ADMIN'
    ) {
      return;
    }

    const access =
      await tx.userSiteAccess.findUnique({
        where: {
          userId_siteId: {
            userId:
              actorId,

            siteId,
          },
        },

        select: {
          id: true,
        },
      });

    if (!access) {
      throw new NotFoundException(
        'Site not found',
      );
    }
  }

  // ===================================================
  // WORKFLOW AUDIT
  // ===================================================

  private async createWorkflowAudit(
    tx: any,
    companyId: string,
    actorId: string,
    permitId: string,
    action: string,
    oldStatus: PermitStatus,
    newStatus: PermitStatus,
    ipAddress?: string,
    additionalValues:
      Record<string, unknown> = {},
  ) {
    await tx.auditLog.create({
      data: {
        companyId,

        userId:
          actorId,

        module:
          'permits',

        action,

        recordId:
          permitId,

        oldValues: {
          status:
            oldStatus,
        },

        newValues: {
          status:
            newStatus,

          ...additionalValues,
        },

        ipAddress:
          ipAddress ??
          null,
      },
    });
  }

  // ===================================================
  // AUDIT SNAPSHOT
  // ===================================================

  private auditSnapshot(
    permit: {
      permitTypeId: string;

      projectId: string;

      siteId: string;

      location:
        | string
        | null;

      contractorDepartment:
        | string
        | null;

      requiredPpe:
        string[];

      hazards:
        string[];

      controlMeasures:
        string[];

      startDateTime:
        Date;

      endDateTime:
        Date;

      description:
        string;

      status:
        PermitStatus;
    },
  ) {
    return {
      permitTypeId:
        permit.permitTypeId,

      projectId:
        permit.projectId,

      siteId:
        permit.siteId,

      location:
        permit.location,

      contractorDepartment:
        permit.contractorDepartment,

      requiredPpe:
        permit.requiredPpe,

      hazards:
        permit.hazards,

      controlMeasures:
        permit.controlMeasures,

      startDateTime:
        permit.startDateTime
          .toISOString(),

      endDateTime:
        permit.endDateTime
          .toISOString(),

      description:
        permit.description,

      status:
        permit.status,
    };
  }

  // ===================================================
  // GENERATE PERMIT NUMBER
  // ===================================================

  private async generatePermitNumber(
    tx: any,
    referenceDate: Date,
  ): Promise<string> {
    const year =
      referenceDate
        .getUTCFullYear();

    // pg_advisory_xact_lock returns PostgreSQL "void".
    // Therefore use $executeRaw instead of $queryRaw.

    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext(${`permit-number-${year}`})
      )
    `;

    const prefix =
      `PTW-${year}-`;

    const latest =
      await tx.permit.findFirst({
        where: {
          permitNumber: {
            startsWith:
              prefix,
          },
        },

        orderBy: {
          permitNumber:
            'desc',
        },

        select: {
          permitNumber:
            true,
        },
      });

    let nextNumber =
      1;

    if (latest) {
      const sequenceText =
        latest.permitNumber
          .slice(
            prefix.length,
          );

      const sequence =
        Number.parseInt(
          sequenceText,
          10,
        );

      if (
        Number.isFinite(
          sequence,
        ) &&
        sequence >=
          1
      ) {
        nextNumber =
          sequence +
          1;
      }
    }

    return (
      prefix +
      String(
        nextNumber,
      ).padStart(
        6,
        '0',
      )
    );
  }

  // ===================================================
  // OPTIONAL STRING
  // ===================================================

  private cleanOptionalString(
    value:
      | string
      | undefined,
  ): string | null {
    if (
      value ===
      undefined
    ) {
      return null;
    }

    const cleaned =
      value.trim();

    return (
      cleaned.length >
      0
        ? cleaned
        : null
    );
  }

  // ===================================================
  // CLEAN STRING ARRAY
  // ===================================================

  private cleanStringArray(
    values:
      | string[]
      | undefined,
  ): string[] {
    if (!values) {
      return [];
    }

    return Array.from(
      new Set(
        values
          .map(
            value =>
              value.trim(),
          )
          .filter(
            value =>
              value.length >
              0,
          ),
      ),
    );
  }

  // ===================================================
  // DATE PARSER
  // ===================================================

  private parseDate(
    value: string,
    fieldName: string,
  ): Date {
    const date =
      new Date(
        value,
      );

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      throw new BadRequestException(
        `${fieldName} must be a valid ISO date/time`,
      );
    }

    return date;
  }

  // ===================================================
  // DATE RANGE
  // ===================================================

  private validateDateRange(
    startDateTime: Date,
    endDateTime: Date,
  ) {
    if (
      endDateTime.getTime() <=
      startDateTime.getTime()
    ) {
      throw new BadRequestException(
        'endDateTime must be later than startDateTime',
      );
    }
  }

  // ===================================================
  // PRISMA ERROR
  // ===================================================

  private isPrismaError(
    error: unknown,
    code: string,
  ): boolean {
    if (
      typeof error !==
        'object' ||
      error ===
        null ||
      !(
        'code' in
        error
      )
    ) {
      return false;
    }

    return (
      (
        error as {
          code?: unknown;
        }
      ).code ===
      code
    );
  }
}
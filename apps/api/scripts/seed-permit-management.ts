import 'dotenv/config';

import {
  PrismaClient,
} from '../src/generated/prisma/client.js';

import {
  PrismaPg,
} from '@prisma/adapter-pg';

const databaseUrl =
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is missing',
  );
}

const prisma =
  new PrismaClient({
    adapter:
      new PrismaPg({
        connectionString:
          databaseUrl,
      }),
  });

// =====================================================
// PERMISSIONS
// =====================================================

const permitPermissions = [
  {
    action: 'read',
    description:
      'View permits',
  },

  {
    action: 'create',
    description:
      'Create permits',
  },

  {
    action: 'update',
    description:
      'Update draft permits',
  },

  {
    action: 'submit',
    description:
      'Submit permits for approval',
  },

  {
    action: 'approve',
    description:
      'Approve pending permits',
  },

  {
    action: 'reject',
    description:
      'Reject pending permits',
  },

  {
    action: 'activate',
    description:
      'Activate approved permits',
  },

  {
    action: 'close',
    description:
      'Close active permits',
  },
] as const;

// =====================================================
// PERMIT TYPES
// =====================================================

const permitTypes = [
  {
    name:
      'Cold Work',

    description:
      'General work activities that do not involve an ignition source.',
  },

  {
    name:
      'Hot Work',

    description:
      'Work involving welding, cutting, grinding, flames, sparks, or other ignition sources.',
  },

  {
    name:
      'Confined Space',

    description:
      'Entry into confined or enclosed spaces requiring controlled access and additional safety precautions.',
  },

  {
    name:
      'Excavation',

    description:
      'Excavation, trenching, digging, or other ground-disturbance activities.',
  },

  {
    name:
      'Working at Heights',

    description:
      'Work performed where there is a risk of falling from height.',
  },

  {
    name:
      'Night Work',

    description:
      'Work carried out during designated night-working hours.',
  },

  {
    name:
      'Lifting',

    description:
      'Lifting activities involving cranes, hoists, rigging equipment, or similar lifting operations.',
  },
] as const;

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log(
    'Starting Permit Management seed...',
  );

  const superAdmin =
    await prisma.role.findUnique({
      where: {
        name:
          'SUPER_ADMIN',
      },
    });

  if (!superAdmin) {
    throw new Error(
      'SUPER_ADMIN role not found',
    );
  }

  // ===================================================
  // PERMISSIONS
  // ===================================================

  await prisma.$transaction(
    async tx => {
      for (
        const definition
        of permitPermissions
      ) {
        const permission =
          await tx.permission.upsert({
            where: {
              module_action: {
                module:
                  'permits',

                action:
                  definition.action,
              },
            },

            update: {
              description:
                definition.description,
            },

            create: {
              module:
                'permits',

              action:
                definition.action,

              description:
                definition.description,
            },
          });

        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId:
                superAdmin.id,

              permissionId:
                permission.id,
            },
          },

          update: {},

          create: {
            roleId:
              superAdmin.id,

            permissionId:
              permission.id,
          },
        });

        console.log(
          `Permission ready: permits:${definition.action}`,
        );
      }
    },
  );

  // ===================================================
  // PERMIT TYPES
  // ===================================================

  for (
    const definition
    of permitTypes
  ) {
    await prisma.permitType.upsert({
      where: {
        name:
          definition.name,
      },

      update: {
        description:
          definition.description,

        isActive:
          true,
      },

      create: {
        name:
          definition.name,

        description:
          definition.description,

        isActive:
          true,
      },
    });

    console.log(
      `Permit type ready: ${definition.name}`,
    );
  }

  console.log(
    'Permit Management seed completed successfully.',
  );
}

main()
  .catch(error => {
    console.error(
      'Permit Management seed failed.',
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  })
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );
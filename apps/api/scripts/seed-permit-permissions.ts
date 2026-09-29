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

const permitPermissions = [
  {
    module: 'permits',
    action: 'read',
    description:
      'View permits',
  },
  {
    module: 'permits',
    action: 'create',
    description:
      'Create permits',
  },
  {
    module: 'permits',
    action: 'update',
    description:
      'Update draft permits',
  },
  {
    module: 'permits',
    action: 'submit',
    description:
      'Submit permits for approval',
  },
  {
    module: 'permits',
    action: 'approve',
    description:
      'Approve pending permits',
  },
  {
    module: 'permits',
    action: 'reject',
    description:
      'Reject pending permits',
  },
  {
    module: 'permits',
    action: 'activate',
    description:
      'Activate approved permits',
  },
  {
    module: 'permits',
    action: 'close',
    description:
      'Close active permits',
  },
] as const;

async function main() {
  console.log(
    'Starting Permit Management permission setup...',
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
                  definition.module,

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
                definition.module,

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
          `Assigned ${definition.module}:${definition.action}`,
        );
      }
    },
  );

  console.log(
    'Permit Management permissions completed',
  );
}

main()
  .catch(error => {
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
import 'dotenv/config';

import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
  }),
});

const actions = [
  'read',
  'create',
  'update',
  'deactivate',
  'activate',
  'reset-password',
] as const;

async function main() {
  console.log(
    'Starting User Management permission setup...',
  );

  const superAdmin =
    await prisma.role.findUnique({
      where: {
        name: 'SUPER_ADMIN',
      },
    });

  if (!superAdmin) {
    throw new Error(
      'SUPER_ADMIN role not found',
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const action of actions) {
      const permission =
        await tx.permission.upsert({
          where: {
            module_action: {
              module: 'users',
              action,
            },
          },

          update: {},

          create: {
            module: 'users',
            action,
            description: `${action} users`,
          },
        });

      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdmin.id,
            permissionId: permission.id,
          },
        },

        update: {},

        create: {
          roleId: superAdmin.id,
          permissionId: permission.id,
        },
      });

      console.log(
        `Assigned users:${action}`,
      );
    }
  });

  console.log(
    'User Management permissions completed',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
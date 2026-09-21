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
  'assign',
] as const;

async function main() {
  const role = await prisma.role.findUnique({
    where: {
      name: 'SUPER_ADMIN',
    },
  });

  if (!role) {
    throw new Error('SUPER_ADMIN role not found');
  }

  await prisma.$transaction(async (tx) => {
    for (const action of actions) {
      const permission = await tx.permission.upsert({
        where: {
          module_action: {
            module: 'sites',
            action,
          },
        },

        update: {},

        create: {
          module: 'sites',
          action,
          description: `${action} sites`,
        },
      });

      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },

        update: {},

        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });

      console.log(`Assigned sites:${action}`);
    }
  });

  console.log('Site permissions setup completed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
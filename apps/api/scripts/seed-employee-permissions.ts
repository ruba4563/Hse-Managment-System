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
] as const;

async function main() {
  console.log('Starting employee permission setup...');

  const adminRole = await prisma.role.findUnique({
    where: {
      name: 'SUPER_ADMIN',
    },
  });

  if (!adminRole) {
    throw new Error('SUPER_ADMIN role not found');
  }

  await prisma.$transaction(async (tx) => {
    for (const action of actions) {
      const permission = await tx.permission.upsert({
        where: {
          module_action: {
            module: 'employees',
            action,
          },
        },

        update: {},

        create: {
          module: 'employees',
          action,
          description: `${action} employees`,
        },
      });

      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id,
          },
        },

        update: {},

        create: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      });

      console.log(`Assigned employees:${action}`);
    }
  });

  console.log('Employee permissions setup completed');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
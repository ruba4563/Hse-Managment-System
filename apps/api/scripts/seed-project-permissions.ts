import 'dotenv/config';

import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing');
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

const actions = [
  'read',
  'create',
  'update',
  'deactivate',
] as const;

async function main() {
  console.log('Starting project permission setup...');

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
            module: 'projects',
            action,
          },
        },

        update: {},

        create: {
          module: 'projects',
          action,
          description: `${action} projects`,
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

      console.log(`Assigned projects:${action}`);
    }
  });

  console.log(
    'Project permissions created successfully',
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
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

// ---------------------------------------------
// 1. Define permissions
// ---------------------------------------------

const permissions = [
  ['dashboard', 'read'],

  ['permits', 'read'],
  ['permits', 'create'],
  ['permits', 'approve'],

  ['inspections', 'read'],
  ['inspections', 'create'],

  ['incidents', 'read'],
  ['incidents', 'create'],

  ['corrective-actions', 'read'],
  ['corrective-actions', 'update'],

  ['users', 'read'],
  ['users', 'create'],

  ['reports', 'read'],
] as const;

// ---------------------------------------------
// 2. Assign permissions to roles
// ---------------------------------------------

const rolePermissions: Record<string, string[]> = {
  SUPER_ADMIN: [
    'dashboard:read',

    'permits:read',
    'permits:create',
    'permits:approve',

    'inspections:read',
    'inspections:create',

    'incidents:read',
    'incidents:create',

    'corrective-actions:read',
    'corrective-actions:update',

    'users:read',
    'users:create',

    'reports:read',
  ],

  HSE_MANAGER: [
    'dashboard:read',

    'permits:read',
    'permits:approve',

    'inspections:read',

    'incidents:read',

    'corrective-actions:read',
    'corrective-actions:update',

    'reports:read',
  ],

  HSE_INSPECTOR: [
    'dashboard:read',

    'permits:read',
    'permits:create',

    'inspections:read',
    'inspections:create',

    'incidents:read',
    'incidents:create',

    'corrective-actions:read',
  ],

  SITE_SUPERVISOR: [
    'dashboard:read',

    'permits:read',
    'permits:create',

    'inspections:read',

    'incidents:read',

    'corrective-actions:read',
    'corrective-actions:update',
  ],

  DEPARTMENT_MANAGER: [
    'dashboard:read',
  ],

  EMPLOYEE: [],
};

// ---------------------------------------------
// 3. Seed permissions
// ---------------------------------------------

async function main() {
  console.log('Starting permissions setup...');

  const roleNames = Object.keys(rolePermissions);

  const existingRoles = await prisma.role.findMany({
    where: {
      name: {
        in: roleNames,
      },
    },
  });

  // Fail before making changes if roles are missing.
  for (const roleName of roleNames) {
    if (!existingRoles.some(role => role.name === roleName)) {
      throw new Error(`Missing role: ${roleName}`);
    }
  }

  await prisma.$transaction(async (tx) => {
    // Create or update permission definitions.
    for (const [module, action] of permissions) {
      await tx.permission.upsert({
        where: {
          module_action: {
            module,
            action,
          },
        },

        update: {},

        create: {
          module,
          action,
          description: `${action} ${module}`,
        },
      });
    }

    const allPermissions = await tx.permission.findMany();

    // Assign permissions to each role.
    for (const role of existingRoles) {
      const assignedKeys = rolePermissions[role.name] ?? [];

      const selectedPermissions = allPermissions.filter(
        permission =>
          assignedKeys.includes(
            `${permission.module}:${permission.action}`,
          ),
      );

      if (selectedPermissions.length === 0) {
        console.log(`${role.name}: no permissions assigned`);
        continue;
      }

      await tx.rolePermission.createMany({
        data: selectedPermissions.map(permission => ({
          roleId: role.id,
          permissionId: permission.id,
        })),

        skipDuplicates: true,
      });

      console.log(
        `${role.name}: ${selectedPermissions.length} permissions`,
      );
    }
  });

  console.log('Permissions setup completed successfully!');
}

main()
  .catch(error => {
    console.error('Permissions setup failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
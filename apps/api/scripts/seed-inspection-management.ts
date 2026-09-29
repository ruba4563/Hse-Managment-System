import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import {
  PrismaClient,
  InspectionCategory,
} from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const permissionDefinitions = [
  {
    module: 'inspections',
    action: 'read',
    description: 'View inspections',
  },

  {
    module: 'inspections',
    action: 'create',
    description: 'Create inspections',
  },

  {
    module: 'inspections',
    action: 'update',
    description: 'Update draft or active inspections',
  },

  {
    module: 'inspections',
    action: 'submit',
    description: 'Submit inspections',
  },

  {
    module: 'inspections',
    action: 'approve',
    description: 'Approve or reject submitted inspections',
  },

  {
    module: 'inspections',
    action: 'close',
    description: 'Close approved inspections',
  },

  {
    module: 'inspections',
    action: 'manage-templates',
    description: 'Manage inspection types and checklist templates',
  },

  {
    module: 'inspections',
    action: 'manage-findings',
    description: 'Create and update inspection findings',
  },
];

// =====================================================
// TEMPLATE DEFINITIONS
// =====================================================

const inspectionTypes = [
  {
    name: 'General Site Inspection',

    code: 'SITE-GENERAL',

    category: InspectionCategory.SITE,

    description: 'General HSE site inspection.',
  },

  {
    name: 'Equipment Inspection',

    code: 'EQUIPMENT-GENERAL',

    category: InspectionCategory.EQUIPMENT,

    description: 'General plant and equipment inspection.',
  },

  {
    name: 'Vehicle Inspection',

    code: 'VEHICLE-GENERAL',

    category: InspectionCategory.VEHICLE,

    description: 'General vehicle safety inspection.',
  },

  {
    name: 'Mixer Inspection',

    code: 'MIXER',

    category: InspectionCategory.EQUIPMENT,

    description: 'Mixer equipment safety inspection.',
  },
];

// All changes are atomic. An explicit company is required when selection
// would otherwise be ambiguous. Reruns preserve customized/deactivated types.
export async function seedInspectionManagement(
  prisma: PrismaClient,
  companyId?: string,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('inspection-management-seed'))`;
      const companies = await tx.company.findMany({
        where: { isActive: true, ...(companyId && { id: companyId }) },
        select: { id: true, name: true },
        take: 2,
      });
      if (companies.length !== 1) {
        throw new Error(
          'Set HSE_SEED_COMPANY_ID to one active company before seeding inspections.',
        );
      }
      const company = companies[0];
      const role = await tx.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
      if (!role || !role.isActive)
        throw new Error('An active SUPER_ADMIN role is required.');
      for (const definition of permissionDefinitions) {
        const permission = await tx.permission.upsert({
          where: {
            module_action: {
              module: definition.module,
              action: definition.action,
            },
          },
          update: { description: definition.description },
          create: definition,
        });
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
      }
      for (const definition of inspectionTypes) {
        await tx.inspectionType.upsert({
          where: {
            companyId_code: { companyId: company.id, code: definition.code },
          },
          update: {},
          create: { ...definition, companyId: company.id },
        });
      }
      return {
        companyId: company.id,
        permissions: permissionDefinitions.length,
        types: inspectionTypes.length,
      };
    },
    { timeout: 30000 },
  );
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not defined.');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    const result = await seedInspectionManagement(
      prisma,
      process.env.HSE_SEED_COMPANY_ID,
    );
    console.log('Inspection Management seed completed successfully.', result);
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

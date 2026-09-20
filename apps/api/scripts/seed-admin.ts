import 'dotenv/config';

import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

// Read the database connection
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing');
}

// Read the temporary bootstrap password
const adminPassword = process.env.HSE_BOOTSTRAP_PASSWORD;

if (!adminPassword || adminPassword.length < 14) {
  throw new Error(
    'Administrator password must contain at least 14 characters',
  );
}

const validAdminPassword: string = adminPassword;

// Create Prisma connection
const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('Starting administrator setup...');

  // 1. Find the Super Administrator role
  const role = await prisma.role.findUnique({
    where: {
      name: 'SUPER_ADMIN',
    },
  });

  if (!role) {
    throw new Error(
      'SUPER_ADMIN role does not exist. Complete Stage 2 first.',
    );
  }

  // 2. Prevent duplicate administrator creation
  const existingAdmin = await prisma.user.findUnique({
    where: {
      username: 'hse_admin',
    },
  });

  if (existingAdmin) {
    console.log(
      'Administrator already exists. No changes were made.',
    );
    return;
  }

  // 3. Hash the password
 const passwordHash = await bcrypt.hash(
  validAdminPassword,
  12,
);

  // 4. Create company and administrator together
  await prisma.$transaction(async (tx) => {
    const company = await tx.company.upsert({
      where: {
        code: 'NH-DEV',
      },

      update: {},

      create: {
        name: 'Nature Horizon Development',
        code: 'NH-DEV',
        isActive: true,
      },
    });

    await tx.user.create({
      data: {
        username: 'hse_admin',

        email: 'hse-admin@localhost.invalid',

        passwordHash,

        companyId: company.id,

        roleId: role.id,

        isActive: true,
      },
    });
  });

  console.log(
    'Administrator created successfully!',
  );

  console.log('Username: hse_admin');
}

main()
  .catch((error) => {
    console.error('Administrator setup failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
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

async function main() {
  console.log(
    'Starting Permit Type seed...',
  );

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
      `Seeded permit type: ${definition.name}`,
    );
  }

  console.log(
    'Permit Type seed completed',
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
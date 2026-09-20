import {
  ValidationPipe,
} from '@nestjs/common';

import {
  NestFactory,
} from '@nestjs/core';

import { AppModule } from './app.module.js';

async function bootstrap() {
  const app =
    await NestFactory.create(AppModule);

  // Enable application-wide input validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,

      forbidNonWhitelisted: true,

      transform: true,
    }),
  );

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Start the local development server
  await app.listen(
    process.env.PORT ?? 3000,
    '127.0.0.1',
  );

  console.log(
    'HSE Backend running on http://localhost:3000',
  );
}

void bootstrap();
import {
  ValidationPipe,
} from '@nestjs/common';

import {
  NestFactory,
} from '@nestjs/core';

import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow requests from the React development server.
  app.enableCors({
    origin: ['http://localhost:5173'],

    methods: [
      'GET',
      'POST',
      'PATCH',
      'PUT',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization',
    ],
  });

  // Validate incoming requests.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Graceful shutdown.
  app.enableShutdownHooks();

  // Start backend.
  await app.listen(
    process.env.PORT ?? 3000,
    '127.0.0.1',
  );

  console.log(
    'HSE Backend running on http://localhost:3000',
  );
}

void bootstrap();
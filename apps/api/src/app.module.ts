import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller.js';

import { AppService } from './app.service.js';

import { PrismaModule } from './prisma/prisma.module.js';

import { AuthModule } from './auth/auth.module.js';

import { CompaniesModule } from './companies/companies.module.js';

import { DepartmentsModule } from './departments/departments.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,

    AuthModule,

    CompaniesModule,

    DepartmentsModule,
  ],

  controllers: [
    AppController,
  ],

  providers: [
    AppService,
  ],
})
export class AppModule {}
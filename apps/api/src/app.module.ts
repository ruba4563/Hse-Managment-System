import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller.js';

import { AppService } from './app.service.js';

import { PrismaModule } from './prisma/prisma.module.js';

import { AuthModule } from './auth/auth.module.js';

import { CompaniesModule } from './companies/companies.module.js';

import { DepartmentsModule } from './departments/departments.module.js';

import { ProjectsModule } from './projects/projects.module.js';

import { SitesModule } from './sites/sites.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,

    AuthModule,

    CompaniesModule,

    DepartmentsModule,

    ProjectsModule,

    SitesModule,
  ],

  controllers: [
    AppController,
  ],

  providers: [
    AppService,
  ],
})
export class AppModule {}
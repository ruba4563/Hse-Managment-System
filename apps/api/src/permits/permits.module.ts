import {
  Module,
} from '@nestjs/common';

import {
  AuthModule,
} from '../auth/auth.module.js';

import {
  PrismaModule,
} from '../prisma/prisma.module.js';

import {
  PermitsController,
} from './permits.controller.js';

import {
  PermitsService,
} from './permits.service.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],

  controllers: [
    PermitsController,
  ],

  providers: [
    PermitsService,
  ],

  exports: [
    PermitsService,
  ],
})
export class PermitsModule {}
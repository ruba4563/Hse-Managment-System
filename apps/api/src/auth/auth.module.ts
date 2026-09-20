import { Module } from '@nestjs/common';

import { JwtModule } from '@nestjs/jwt';

import { ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller.js';

import { AuthService } from './auth.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        secret:
          configService.getOrThrow<string>(
            'JWT_SECRET',
          ),

        signOptions: {
          expiresIn: '15m' as const,
          issuer: 'hse-api',
          audience: 'hse-web',
        },
      }),
    }),
  ],

  controllers: [AuthController],

  providers: [AuthService],

  exports: [AuthService],
})
export class AuthModule {}
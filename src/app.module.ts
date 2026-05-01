import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { FirebaseModule } from './firebase/firebase.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { MembershipsModule } from './memberships/memberships.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AffiliatesModule } from './affiliate/affiliate.module';
import { FirebaseAuthGuard } from './common/guards/firebase-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000,  limit: 15  },
      { name: 'long',  ttl: 60000, limit: 100 },
    ]),
    FirebaseModule,
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    MembershipsModule,
    ApiKeysModule,
    AffiliatesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}

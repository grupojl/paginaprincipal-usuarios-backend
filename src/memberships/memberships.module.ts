import { Module } from '@nestjs/common';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports:     [AuditModule],
  controllers: [MembershipsController],
  providers:   [MembershipsService],
  exports:     [MembershipsService],
})
export class MembershipsModule {}

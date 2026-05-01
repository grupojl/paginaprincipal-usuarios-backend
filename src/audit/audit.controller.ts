import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { AuditService } from './audit.service';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('organizations/me/audit')
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  /** GET /api/v1/organizations/me/audit?take=50&skip=0 */
  @Get()
  @Roles('OWNER', 'ADMIN')
  getAuditLog(
    @Tenant() tenant: TenantContext,
    @Query('take', new DefaultValuePipe(50), ParseIntPipe) take: number,
    @Query('skip', new DefaultValuePipe(0),  ParseIntPipe) skip: number,
  ) {
    return this.svc.getByOrg(tenant.organizationId, take, skip);
  }
}

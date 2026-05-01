import {
  Controller, Get, Post, Delete,
  Param, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('organizations/me/api-keys')
export class ApiKeysController {
  constructor(private readonly svc: ApiKeysService) {}

  /** GET /api/v1/organizations/me/api-keys */
  @Get()
  list(@Tenant() tenant: TenantContext) {
    return this.svc.list(tenant.organizationId);
  }

  /** POST /api/v1/organizations/me/api-keys */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('OWNER', 'ADMIN')
  create(
    @Tenant() tenant: TenantContext,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.svc.create(tenant.organizationId, tenant.userId, dto);
  }

  /** DELETE /api/v1/organizations/me/api-keys/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles('OWNER', 'ADMIN')
  revoke(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.svc.revoke(tenant.organizationId, tenant.userId, id);
  }
}

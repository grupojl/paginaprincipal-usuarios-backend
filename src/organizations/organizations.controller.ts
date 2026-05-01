import { Controller, Get, Patch, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Tenant } from '../common/decorators/tenant.decorator';
import type { TenantContext } from '../common/types/tenant-context';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly svc: OrganizationsService) {}

  /** GET /api/v1/organizations/me — primera org donde el user es OWNER */
  @Get('me')
  getMyOrganization(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.getMyOrganization(user.uid);
  }

  /** GET /api/v1/organizations — todas las orgs del usuario */
  @Get()
  getAllMyOrganizations(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.getMyOrganizations(user.uid);
  }

  /** GET /api/v1/organizations/me/stats */
  @Get('me/stats')
  getStats(@Tenant() tenant: TenantContext) {
    return this.svc.getOrgStats(tenant.organizationId);
  }

  /** PATCH /api/v1/organizations/me */
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  updateMyOrganization(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.svc.updateMyOrganization(user.uid, dto);
  }
}

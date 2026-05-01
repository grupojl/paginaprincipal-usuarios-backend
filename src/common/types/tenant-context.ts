import type { MembershipRole } from '@prisma/client';

export interface ProductPermissions {
  canRead:  boolean;
  canWrite: boolean;
}

export interface TenantProductPermissions {
  payments?: ProductPermissions;
  chat?:     ProductPermissions;
  ads?:      ProductPermissions;
  [key: string]: ProductPermissions | undefined;
}

/**
 * Inyectado por TenantGuard en request.tenant.
 * Disponible en cualquier endpoint que use @Tenant().
 */
export interface TenantContext {
  userId:             string;
  organizationId:     string;
  role:               MembershipRole;
  productPermissions: TenantProductPermissions;
  apiKeyScopes?:      string[];
}

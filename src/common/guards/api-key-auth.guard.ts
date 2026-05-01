import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { MembershipRole } from '@prisma/client';
import { ApiKeysService } from '../../api-keys/api-keys.service';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawKey = request.headers['x-api-key'] as string;

    if (!rawKey) return false;

    try {
      const apiKey = await this.apiKeysService.validateApiKey(rawKey);

      request['tenant'] = {
        organizationId: apiKey.organizationId,
        role: MembershipRole.MEMBER,
        apiKeyScopes: apiKey.scopes,
      };

      return true;
    } catch {
      return false;
    }
  }
}
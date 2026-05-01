import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  log(params: {
    organizationId?: string;
    userId?:         string;
    action:          string;
    resource?:       string;
    resourceId?:     string;
    metadata?:       Prisma.InputJsonValue;
    ipAddress?:      string;
    userAgent?:      string;
  }): void {
    void this.prisma.auditLog
      .create({
        data: {
          organizationId: params.organizationId,
          userId:         params.userId,
          action:         params.action,
          resource:       params.resource,
          resourceId:     params.resourceId,
          metadata:       params.metadata ?? Prisma.JsonNull,
          ipAddress:      params.ipAddress,
          userAgent:      params.userAgent,
        },
      })
      .catch((err) => this.logger.error('AuditLog write failed:', err));
  }

  async getByOrg(organizationId: string, take = 50, skip = 0) {
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where:   { organizationId },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          user: { select: { email: true, displayName: true, avatarUrl: true } },
        },
      }),
      this.prisma.auditLog.count({ where: { organizationId } }),
    ]);

    return { success: true, data: { logs, total, take, skip } };
  }
}

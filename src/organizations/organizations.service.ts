import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipRole, Prisma } from '@prisma/client';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 60);
  }

  private async ensureSlugUnique(slug: string, excludeId?: string): Promise<string> {
    const base    = this.slugify(slug);
    let candidate = base;
    let i         = 1;

    while (true) {
      const existing = await this.prisma.organization.findUnique({
        where: { slug: candidate },
      });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${base}-${i++}`;
    }
  }

  // ─── Crear org para un usuario (llamado desde UsersService) ───────────────

  async createForUser(userId: string, orgName?: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;

    const baseSlug = orgName ? this.slugify(orgName) : `org-${userId.substring(0, 8)}`;
    const slug     = await this.ensureSlugUnique(baseSlug);

    return client.organization.create({
      data: {
        name: orgName ?? null,
        slug,
        enabledProducts: {},
        systemSettings:  {},
        memberships: {
          create: {
            userId,
            role:               MembershipRole.OWNER,
            productPermissions: {},
          },
        },
      },
      include: { memberships: true },
    });
  }

  // ─── Leer ──────────────────────────────────────────────────────────────────

  async getMyOrganizations(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const memberships = await this.prisma.membership.findMany({
      where:   { userId: user.id },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      success: true,
      data: memberships.map((m) => ({
        ...m.organization,
        role:               m.role,
        productPermissions: m.productPermissions,
        membershipId:       m.id,
      })),
    };
  }

  async getMyOrganization(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const membership = await this.prisma.membership.findFirst({
      where:   { userId: user.id, role: MembershipRole.OWNER },
      include: { organization: true },
    });

    if (!membership) throw new NotFoundException('No tenés una organización como Owner');

    return { success: true, data: { ...membership.organization, role: membership.role } };
  }

  /**
   * Estadísticas básicas de la org para el Overview del dashboard.
   */
  async getOrgStats(organizationId: string) {
    const [membersCount, keysCount, recentAudit] = await Promise.all([
      this.prisma.membership.count({ where: { organizationId } }),
      this.prisma.apiKey.count({ where: { organizationId, revokedAt: null } }),
      this.prisma.auditLog.findMany({
        where:   { organizationId },
        orderBy: { createdAt: 'desc' },
        take:    10,
        select:  { id: true, action: true, resource: true, createdAt: true, userId: true },
      }),
    ]);

    return { success: true, data: { membersCount, activeApiKeys: keysCount, recentActivity: recentAudit } };
  }

  // ─── Actualizar ────────────────────────────────────────────────────────────

  async updateMyOrganization(firebaseUid: string, dto: UpdateOrganizationDto) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.id,
        role:   { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
      },
      include: { organization: true },
    });

    if (!membership) {
      throw new ForbiddenException('Solo Owner o Admin pueden editar la organización');
    }

    const org = membership.organization;

    // Validar slug único si cambió
    if (dto.slug && dto.slug !== org.slug) {
      const normalized = this.slugify(dto.slug);
      const conflict   = await this.prisma.organization.findUnique({ where: { slug: normalized } });
      if (conflict && conflict.id !== org.id) {
        throw new BadRequestException(`El slug "${normalized}" ya está en uso`);
      }
      dto.slug = normalized;
    }

    const data: Prisma.OrganizationUpdateInput = {};
    if (dto.name            !== undefined) data.name            = dto.name;
    if (dto.slug            !== undefined) data.slug            = dto.slug;
    if (dto.description     !== undefined) data.description     = dto.description;
    if (dto.logoUrl         !== undefined) data.logoUrl         = dto.logoUrl;
    if (dto.website         !== undefined) data.website         = dto.website;
    if (dto.phone           !== undefined) data.phone           = dto.phone;
    if (dto.address         !== undefined) data.address         = dto.address;
    if (dto.enabledProducts !== undefined) data.enabledProducts = dto.enabledProducts as Prisma.InputJsonValue;
    if (dto.systemSettings  !== undefined) data.systemSettings  = dto.systemSettings  as Prisma.InputJsonValue;

    const updated = await this.prisma.organization.update({
      where: { id: org.id },
      data,
    });

    this.logger.log(`Org ${org.id} actualizada por ${user.email}`);
    return { success: true, message: 'Organización actualizada', data: updated };
  }
}

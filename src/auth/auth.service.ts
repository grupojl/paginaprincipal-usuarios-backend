import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sincroniza el usuario de Firebase con la DB.
   * Si es nuevo lo crea; si existe, actualiza displayName/avatarUrl.
   * Registra el código de afiliado si se pasa en el primer sync.
   */
  async syncUser(
    firebaseUser: CurrentUserPayload,
    affiliateCode?: string,
  ) {
    const { user, isNew } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { firebaseUid: firebaseUser.uid },
        include: {
          memberships: {
            include: { organization: true },
          },
          affiliateData: true,
        },
      });

      if (existing) {
        // Actualizar nombre/avatar si cambiaron en Firebase
        const needsUpdate =
          (firebaseUser.displayName && existing.displayName !== firebaseUser.displayName) ||
          (firebaseUser.avatarUrl   && existing.avatarUrl   !== firebaseUser.avatarUrl);

        const updated = needsUpdate
          ? await tx.user.update({
              where: { id: existing.id },
              data: {
                displayName: firebaseUser.displayName ?? existing.displayName,
                avatarUrl:   firebaseUser.avatarUrl   ?? existing.avatarUrl,
              },
              include: {
                memberships: { include: { organization: true } },
                affiliateData: true,
              },
            })
          : existing;

        return { user: updated, isNew: false };
      }

      const created = await tx.user.create({
        data: {
          firebaseUid: firebaseUser.uid,
          email:       firebaseUser.email,
          displayName: firebaseUser.displayName,
          avatarUrl:   firebaseUser.avatarUrl,
        },
        include: {
          memberships: { include: { organization: true } },
          affiliateData: true,
        },
      });

      return { user: created, isNew: true };
    });

    // Registrar referido en background (no bloquea la respuesta)
    if (isNew && affiliateCode) {
      this.registerReferral(user.id, affiliateCode).catch((err) =>
        this.logger.warn(`Error registrando referido ${affiliateCode}: ${(err as Error).message}`),
      );
    }

    if (isNew) {
      this.logger.log(`Nuevo usuario: ${user.email}`);
    }

    return { user, isNew };
  }

  /**
   * Devuelve el perfil completo del usuario autenticado + sus orgs + permisos.
   * Los frontends de todos los sistemas llaman a este endpoint al iniciar.
   */
  async getMe(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      include: {
        memberships: {
          include: {
            organization: {
              select: {
                id:              true,
                name:            true,
                slug:            true,
                logoUrl:         true,
                enabledProducts: true,
              },
            },
          },
        },
        affiliateData: true,
      },
    });

    if (!user) return null;

    return {
      id:          user.id,
      firebaseUid: user.firebaseUid,
      email:       user.email,
      displayName: user.displayName,
      avatarUrl:   user.avatarUrl,
      organizations: user.memberships.map((m) => ({
        id:                 m.organization.id,
        name:               m.organization.name,
        slug:               m.organization.slug,
        logoUrl:            m.organization.logoUrl,
        enabledProducts:    m.organization.enabledProducts,
        role:               m.role,
        productPermissions: m.productPermissions,
        membershipId:       m.id,
      })),
      affiliateData: user.affiliateData,
      isAffiliate:   !!user.affiliateData,
    };
  }

  private async registerReferral(newUserId: string, affiliateCode: string): Promise<void> {
    const affiliate = await this.prisma.user.findUnique({
      where: { affiliateCode },
      include: { affiliateData: true },
    });

    if (!affiliate?.affiliateData) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: newUserId },
        data: { referredByCode: affiliateCode },
      });
      await tx.affiliateData.update({
        where: { userId: affiliate.id },
        data: { referralCount: { increment: 1 } },
      });
    });
  }
}

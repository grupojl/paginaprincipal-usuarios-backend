import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AffiliatesService {
  private readonly logger = new Logger(AffiliatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      include: { affiliateData: true },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (!user.affiliateCode || !user.affiliateData) {
      throw new ForbiddenException(
        'Este usuario no tiene el rol de Afiliado activo',
      );
    }

    return {
      success: true,
      data: {
        affiliateCode: user.affiliateCode,
        balance: user.affiliateData.balance,
        referralCount: user.affiliateData.referralCount,
        createdAt: user.affiliateData.createdAt,
      },
    };
  }

  async getMyReferrals(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (!user.affiliateCode) {
      throw new ForbiddenException(
        'Este usuario no tiene el rol de Afiliado activo',
      );
    }

    const referrals = await this.prisma.user.findMany({
      where: { referredByCode: user.affiliateCode },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: {
        affiliateCode: user.affiliateCode,
        total: referrals.length,
        referrals,
      },
    };
  }

  async registerReferral(newUserId: string, affiliateCode: string): Promise<void> {
    const affiliate = await this.prisma.user.findUnique({
      where: { affiliateCode },
      include: { affiliateData: true },
    });

    if (!affiliate || !affiliate.affiliateData) {
      this.logger.warn(`Código de afiliado inválido: ${affiliateCode}`);
      return;
    }

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

    this.logger.log(
      `Referido registrado: usuario ${newUserId} via ${affiliateCode}`,
    );
  }
}
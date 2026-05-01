import {
  Injectable, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { SelectRoleDto, UserRole } from './dto/select-role.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orgsService: OrganizationsService,
  ) {}

  async findByFirebaseUid(firebaseUid: string) {
    return this.prisma.user.findUnique({
      where: { firebaseUid },
      include: {
        memberships: { include: { organization: true } },
        affiliateData: true,
      },
    });
  }

  async selectRole(firebaseUid: string, dto: SelectRoleDto) {
    const user = await this.prisma.user.findUnique({
      where:   { firebaseUid },
      include: { memberships: true, affiliateData: true },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado. Llamá a /auth/sync primero.');

    if (dto.role === UserRole.OWNER) {
      const alreadyOwner = user.memberships.some((m) => m.role === 'OWNER');
      if (alreadyOwner) throw new BadRequestException('El usuario ya tiene una organización como Owner');

      await this.prisma.$transaction(async (tx) => {
        await this.orgsService.createForUser(user.id, undefined, tx);
      });

      const fresh = await this.findByFirebaseUid(firebaseUid);
      this.logger.log(`${user.email} activado como Owner`);
      return { success: true, message: 'Organización creada', data: fresh };
    }

    if (dto.role === UserRole.AFFILIATE) {
      if (user.affiliateData) throw new BadRequestException('El usuario ya es Afiliado');

      const code = await this.generateUniqueCode();

      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { affiliateCode: code } });
        await tx.affiliateData.create({ data: { userId: user.id } });
      });

      const fresh = await this.findByFirebaseUid(firebaseUid);
      this.logger.log(`${user.email} activado como Affiliate: ${code}`);
      return { success: true, message: 'Código de afiliado generado', data: fresh };
    }
  }

  private async generateUniqueCode(): Promise<string> {
    let code = '';
    let exists = true;
    while (exists) {
      code = `RE-${uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase()}`;
      const found = await this.prisma.user.findUnique({ where: { affiliateCode: code } });
      exists = !!found;
    }
    return code;
  }
}

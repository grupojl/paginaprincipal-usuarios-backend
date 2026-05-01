import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { InvitationStatus, MembershipRole } from '@prisma/client';

const INVITATION_EXPIRY_DAYS = 7;

@Injectable()
export class MembershipsService {
  private readonly logger = new Logger(MembershipsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Helper: obtener org donde el user es OWNER o ADMIN ───────────────────

  private async requireAdminOrOwner(firebaseUid: string) {
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
      throw new ForbiddenException('Se requiere rol OWNER o ADMIN para esta acción');
    }

    return { user, org: membership.organization, role: membership.role };
  }

  // ─── Listar miembros ───────────────────────────────────────────────────────

  async listMembers(firebaseUid: string) {
    const { org } = await this.requireAdminOrOwner(firebaseUid);

    const [members, pendingInvitations] = await Promise.all([
      this.prisma.membership.findMany({
        where:   { organizationId: org.id },
        include: {
          user: {
            select: { id: true, email: true, displayName: true, avatarUrl: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.invitation.findMany({
        where: {
          organizationId: org.id,
          status:         InvitationStatus.PENDING,
          expiresAt:      { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      success: true,
      data: {
        members: members.map((m) => ({
          membershipId:       m.id,
          userId:             m.userId,
          email:              m.user.email,
          displayName:        m.user.displayName,
          avatarUrl:          m.user.avatarUrl,
          role:               m.role,
          productPermissions: m.productPermissions,
          joinedAt:           m.createdAt,
        })),
        pendingInvitations,
      },
    };
  }

  // ─── Invitar miembro ───────────────────────────────────────────────────────

  async inviteMember(firebaseUid: string, dto: InviteMemberDto) {
    const { user: owner, org } = await this.requireAdminOrOwner(firebaseUid);
    const emailNorm            = dto.email.toLowerCase();

    if (emailNorm === owner.email.toLowerCase()) {
      throw new BadRequestException('No podés invitarte a vos mismo');
    }

    // Verificar que no sea ya miembro
    const alreadyMember = await this.prisma.membership.findFirst({
      where: {
        organizationId: org.id,
        user:           { email: emailNorm },
      },
    });
    if (alreadyMember) {
      throw new BadRequestException('Este email ya es miembro de la organización');
    }

    // Invalidar invitaciones previas pendientes para este email
    await this.prisma.invitation.updateMany({
      where: {
        organizationId: org.id,
        email:          emailNorm,
        status:         InvitationStatus.PENDING,
      },
      data: { status: InvitationStatus.REVOKED },
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId:     org.id,
        email:              emailNorm,
        role:               dto.role ?? MembershipRole.MEMBER,
        expiresAt,
        productPermissions: (dto.productPermissions ?? {}) as any,
        invitedByUserId:    owner.id,
        status:             InvitationStatus.PENDING,
      },
    });

    const inviteLink = `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/invite/${invitation.token}`;

    this.audit.log({
      organizationId: org.id,
      userId:         owner.id,
      action:         'member.invite',
      resource:       'invitation',
      resourceId:     invitation.id,
      metadata:       { email: emailNorm, role: dto.role },
    });

    this.logger.log(`Invitación enviada a ${emailNorm} para org ${org.id}`);

    return {
      success: true,
      message: 'Invitación generada exitosamente',
      data:    { invitation, inviteLink, expiresAt },
    };
  }

  // ─── Actualizar miembro ────────────────────────────────────────────────────

  async updateMember(firebaseUid: string, membershipId: string, dto: UpdateMemberDto) {
    const { user: actor, org, role: actorRole } = await this.requireAdminOrOwner(firebaseUid);

    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId: org.id },
    });

    if (!membership) throw new NotFoundException('Miembro no encontrado');

    // ADMIN no puede cambiar el rol de un OWNER
    if (
      actorRole === MembershipRole.ADMIN &&
      membership.role === MembershipRole.OWNER
    ) {
      throw new ForbiddenException('No podés modificar al OWNER de la organización');
    }

    // Nadie puede degradar a otro OWNER (solo el OWNER puede hacerlo sobre sí mismo)
    if (dto.role && membership.role === MembershipRole.OWNER && dto.role !== MembershipRole.OWNER) {
      throw new ForbiddenException('No podés cambiar el rol del OWNER');
    }

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data:  {
        ...(dto.role               !== undefined && { role:               dto.role }),
        ...(dto.productPermissions !== undefined && { productPermissions: dto.productPermissions as any }),
      },
      include: {
        user: { select: { email: true, displayName: true } },
      },
    });

    this.audit.log({
      organizationId: org.id,
      userId:         actor.id,
      action:         'member.update',
      resource:       'membership',
      resourceId:     membershipId,
      metadata:       dto as any,
    });

    return { success: true, message: 'Miembro actualizado', data: updated };
  }

  // ─── Remover miembro ───────────────────────────────────────────────────────

  async removeMember(firebaseUid: string, membershipId: string) {
    const { user: actor, org } = await this.requireAdminOrOwner(firebaseUid);

    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId: org.id },
      include: { user: { select: { email: true } } },
    });

    if (!membership) throw new NotFoundException('Miembro no encontrado');

    if (membership.role === MembershipRole.OWNER) {
      throw new ForbiddenException('No podés remover al OWNER de la organización');
    }

    if (membership.userId === actor.id) {
      throw new BadRequestException('No podés removerte a vos mismo');
    }

    await this.prisma.membership.delete({ where: { id: membershipId } });

    this.audit.log({
      organizationId: org.id,
      userId:         actor.id,
      action:         'member.remove',
      resource:       'membership',
      resourceId:     membershipId,
      metadata:       { removedEmail: membership.user.email },
    });

    return { success: true, message: 'Miembro removido de la organización' };
  }

  // ─── Info de invitación (pública) ─────────────────────────────────────────

  async getInvitationInfo(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where:   { token },
      include: {
        organization: {
          select: { id: true, name: true, logoUrl: true, slug: true },
        },
      },
    });

    if (!invitation)                                   throw new NotFoundException('Invitación no encontrada');
    if (invitation.status === InvitationStatus.REVOKED) throw new BadRequestException('Esta invitación fue cancelada');
    if (invitation.status === InvitationStatus.ACCEPTED) throw new BadRequestException('Esta invitación ya fue utilizada');
    if (new Date() > invitation.expiresAt)             throw new BadRequestException('Esta invitación expiró');

    return {
      success: true,
      data: {
        email:              invitation.email,
        role:               invitation.role,
        organization:       invitation.organization,
        productPermissions: invitation.productPermissions,
        expiresAt:          invitation.expiresAt,
      },
    };
  }

  // ─── Aceptar invitación ───────────────────────────────────────────────────

  async acceptInvitation(token: string, firebaseUid: string) {
    const user = await this.prisma.user.findUnique({ where: { firebaseUid } });
    if (!user) throw new NotFoundException('Usuario no encontrado. Llamá a /auth/sync primero.');

    const invitation = await this.prisma.invitation.findUnique({ where: { token } });

    if (!invitation)                                    throw new NotFoundException('Invitación no encontrada');
    if (invitation.status === InvitationStatus.ACCEPTED) throw new BadRequestException('Esta invitación ya fue utilizada');
    if (invitation.status === InvitationStatus.REVOKED)  throw new BadRequestException('Esta invitación fue cancelada');
    if (new Date() > invitation.expiresAt)              throw new BadRequestException('Esta invitación expiró');

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException(
        `Esta invitación es para ${invitation.email}. Iniciá sesión con esa cuenta.`,
      );
    }

    // Verificar que no sea ya miembro
    const existing = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId:         user.id,
          organizationId: invitation.organizationId,
        },
      },
    });

    if (existing) throw new BadRequestException('Ya sos miembro de esta organización');

    await this.prisma.$transaction(async (tx) => {
      await tx.membership.create({
        data: {
          userId:             user.id,
          organizationId:     invitation.organizationId,
          role:               invitation.role,
          productPermissions: invitation.productPermissions as any,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data:  {
          status:           InvitationStatus.ACCEPTED,
          acceptedByUserId: user.id,
          acceptedAt:       new Date(),
        },
      });
    });

    this.audit.log({
      organizationId: invitation.organizationId,
      userId:         user.id,
      action:         'member.accept_invitation',
      resource:       'invitation',
      resourceId:     invitation.id,
    });

    this.logger.log(`${user.email} aceptó invitación para org ${invitation.organizationId}`);

    return {
      success: true,
      message: '¡Bienvenido al equipo! Ya sos miembro activo.',
    };
  }

  // ─── Revocar invitación pendiente ─────────────────────────────────────────

  async revokeInvitation(firebaseUid: string, invitationId: string) {
    const { user: actor, org } = await this.requireAdminOrOwner(firebaseUid);

    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: org.id },
    });

    if (!invitation) throw new NotFoundException('Invitación no encontrada');

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Solo se pueden revocar invitaciones pendientes');
    }

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data:  { status: InvitationStatus.REVOKED },
    });

    this.audit.log({
      organizationId: org.id,
      userId:         actor.id,
      action:         'member.revoke_invitation',
      resource:       'invitation',
      resourceId:     invitationId,
      metadata:       { email: invitation.email },
    });

    return { success: true, message: 'Invitación revocada' };
  }
}

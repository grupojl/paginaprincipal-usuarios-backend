import {
  IsEmail, IsEnum, IsOptional, IsObject, MaxLength,
} from 'class-validator';
import { MembershipRole } from '@prisma/client';

export class InviteMemberDto {
  @IsEmail({}, { message: 'El email debe ser válido' })
  email: string;

  @IsEnum(MembershipRole, { message: 'Rol inválido. Usar: ADMIN, MEMBER, VIEWER' })
  @IsOptional()
  role?: MembershipRole = MembershipRole.MEMBER;

  // { "payments": { "canRead": true, "canWrite": false }, "chat": { ... } }
  @IsObject()
  @IsOptional()
  productPermissions?: Record<string, { canRead: boolean; canWrite: boolean }>;

  @IsOptional()
  @MaxLength(200)
  message?: string;   // mensaje personalizado para el email de invitación
}

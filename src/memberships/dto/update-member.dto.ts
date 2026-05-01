import { IsEnum, IsOptional, IsObject } from 'class-validator';
import { MembershipRole } from '@prisma/client';

export class UpdateMemberDto {
  @IsEnum(MembershipRole)
  @IsOptional()
  role?: MembershipRole;

  @IsObject()
  @IsOptional()
  productPermissions?: Record<string, { canRead: boolean; canWrite: boolean }>;
}

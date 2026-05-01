import { IsOptional, IsString, IsUrl } from 'class-validator';

export class SyncUserDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  @IsUrl({}, { message: 'avatarUrl debe ser una URL válida' })
  avatarUrl?: string;
}

import {
  IsString, IsOptional, IsUrl, MaxLength, MinLength,
  IsObject,
} from 'class-validator';

export class UpdateOrganizationDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  // Solo letras minúsculas, números y guiones
  slug?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  address?: string;

  // Qué sistemas tiene habilitados esta org
  // { "payments": true, "chat": true, "ads": false }
  @IsObject()
  @IsOptional()
  enabledProducts?: Record<string, boolean>;

  // Config por sistema — libre
  @IsObject()
  @IsOptional()
  systemSettings?: Record<string, unknown>;
}

import {
  IsString, IsArray, IsEnum, IsOptional,
  IsDateString, MaxLength, MinLength, ArrayNotEmpty,
} from 'class-validator';
import { ApiKeyScope } from '@prisma/client';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'Debe especificar al menos un scope' })
  @IsEnum(ApiKeyScope, { each: true, message: 'Scope inválido' })
  scopes: ApiKeyScope[];

  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

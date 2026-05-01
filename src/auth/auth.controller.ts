import {
  Controller,
  Post,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { SyncUserDto } from './dto/sync.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/sync?ref=RE-XXXXXXXX
   * Primer llamado tras login en Firebase.
   * Todos los sistemas del ecosistema llaman a este endpoint con el mismo token.
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncUser(
    @CurrentUser() user: CurrentUserPayload,
    @Body() _dto: SyncUserDto,       // body opcional, los datos vienen del token
    @Query('ref') affiliateCode?: string,
  ) {
    const firebaseUser = {
      ...user,
      displayName: user.displayName,
      avatarUrl:   user.avatarUrl,
    };

    const result = await this.authService.syncUser(firebaseUser, affiliateCode);

    return {
      success: true,
      isNew:   result.isNew,
      message: result.isNew ? 'Usuario creado' : 'Usuario sincronizado',
      data:    result.user,
    };
  }

  /**
   * GET /api/v1/auth/me
   * Perfil completo: datos personales + todas las orgs + permisos por producto.
   * Todos los frontends usan este endpoint para hidratar su contexto inicial.
   */
  @Get('me')
  async getMe(@CurrentUser() user: CurrentUserPayload) {
    const profile = await this.authService.getMe(user.uid);
    if (!profile) throw new NotFoundException('Usuario no encontrado. Llamá a /auth/sync primero.');
    return { success: true, data: profile };
  }
}

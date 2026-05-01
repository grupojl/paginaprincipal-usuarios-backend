import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as admin from 'firebase-admin';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req   = ctx.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);

    if (!token) throw new UnauthorizedException('Token de autenticación requerido');

    if (!admin.apps.length) {
      throw new UnauthorizedException('Firebase no está configurado en este servidor');
    }

    try {
      const decoded = await admin.app().auth().verifyIdToken(token);
      req['user'] = {
        uid:           decoded.uid,
        email:         decoded.email ?? '',
        emailVerified: decoded.email_verified ?? false,
        displayName:   decoded.name,
        avatarUrl:     decoded.picture,
      };
      return true;
    } catch (err) {
      this.logger.warn(`Token inválido: ${(err as Error).message}`);
      throw new UnauthorizedException('Token de Firebase inválido o expirado');
    }
  }

  private extractToken(req: Request): string | undefined {
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

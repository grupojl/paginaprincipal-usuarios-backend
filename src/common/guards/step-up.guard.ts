import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import * as admin from 'firebase-admin';

@Injectable()
export class StepUpAuthGuard implements CanActivate {
  private readonly STEPUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new ForbiddenException('Token requerido para esta acción');
    }

    const decodedToken = await admin.app().auth().verifyIdToken(token);
    const authTime = decodedToken.auth_time * 1000;
    const now = Date.now();

    if (now - authTime > this.STEPUP_WINDOW_MS) {
      throw new ForbiddenException(
        'Esta acción requiere re-autenticación reciente. ' +
          'Por favor iniciá sesión nuevamente.',
      );
    }

    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
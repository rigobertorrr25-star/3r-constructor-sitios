import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload, AuthUser } from './auth.types.js';

interface AuthedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    const value = Array.isArray(header) ? header[0] : header;
    const [scheme, token] = value?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Falta el token');

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      req.user = { id: payload.sub, sessionId: payload.sid, roles: payload.roles };
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}

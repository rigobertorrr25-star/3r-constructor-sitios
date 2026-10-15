import { timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

const IP = /^[0-9a-fA-F:.]{3,45}$/;

/**
 * Como el ThrottlerGuard de siempre, pero cuenta por la IP real del visitante cuando la petición viene del servidor de
 * la web: la web la manda en `x-3r-client-ip` junto con CRON_SECRET en `x-3r-relay`. Sin la clave correcta, se usa la
 * IP de la conexión (nadie puede inventarse otra IP para saltarse los límites).
 */
@Injectable()
export class VisitorThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const secret = process.env.CRON_SECRET;
    const relay = req.headers?.['x-3r-relay'];
    const ip = req.headers?.['x-3r-client-ip'];
    if (secret && typeof relay === 'string' && typeof ip === 'string' && IP.test(ip)) {
      const a = Buffer.from(relay);
      const b = Buffer.from(secret);
      if (a.length === b.length && timingSafeEqual(a, b)) return `visitor:${ip}`;
    }
    return req.ip;
  }
}

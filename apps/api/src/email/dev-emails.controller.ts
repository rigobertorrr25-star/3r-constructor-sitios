import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sentEmails } from './logging-mail-sender.js';

/**
 * Bandeja de entrada de prueba: solo responde en desarrollo, y mientras no haya RESEND_API_KEY
 * (modo de prueba, sin cuenta de verdad). Nunca responde con NODE_ENV=production — sin este
 * candado, cualquiera en internet podría leer aquí enlaces de recuperar contraseña o verificar
 * correo de clientes reales mientras no se haya configurado Resend.
 */
@Controller('dev/emails')
export class DevEmailsController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  list(@Query('to') to?: string) {
    if (this.config.get<string>('NODE_ENV') === 'production') throw new NotFoundException();
    if (this.config.get<string>('RESEND_API_KEY')) throw new NotFoundException();
    const items = to ? sentEmails.filter((mail) => mail.to === to) : sentEmails;
    return items.slice(-20);
  }
}

import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sentEmails } from './logging-mail-sender.js';

/**
 * Bandeja de entrada de prueba: solo responde mientras no haya RESEND_API_KEY (modo de prueba,
 * sin cuenta de verdad). En cuanto se configura la llave, esta ruta deja de existir.
 */
@Controller('dev/emails')
export class DevEmailsController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  list(@Query('to') to?: string) {
    if (this.config.get<string>('RESEND_API_KEY')) throw new NotFoundException();
    const items = to ? sentEmails.filter((mail) => mail.to === to) : sentEmails;
    return items.slice(-20);
  }
}

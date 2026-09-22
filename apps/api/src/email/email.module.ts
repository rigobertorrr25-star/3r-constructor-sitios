import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevEmailsController } from './dev-emails.controller.js';
import { EmailService } from './email.service.js';
import { LoggingMailSender } from './logging-mail-sender.js';
import { MAIL_SENDER } from './mail-sender.js';
import { ResendMailSender } from './resend-mail-sender.js';

@Global()
@Module({
  controllers: [DevEmailsController],
  providers: [
    {
      provide: MAIL_SENDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('RESEND_API_KEY');
        // Sin llave, no hay cuenta que crear: se registran los correos en vez de mandarlos de verdad.
        if (!apiKey) return new LoggingMailSender();
        const from = config.get<string>('EMAIL_FROM') ?? '3R <onboarding@resend.dev>';
        return new ResendMailSender(apiKey, from);
      },
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}

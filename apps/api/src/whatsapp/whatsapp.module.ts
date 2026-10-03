import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { FakeWhatsappClient, MetaWhatsappClient, WHATSAPP_CLIENT } from './whatsapp-client.js';
import { AdminWhatsappController, WhatsappController, WhatsappWebhookController } from './whatsapp.controller.js';
import { WhatsappService } from './whatsapp.service.js';

@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [WhatsappController, AdminWhatsappController, WhatsappWebhookController],
  providers: [
    WhatsappService,
    {
      provide: WHATSAPP_CLIENT,
      inject: [ConfigService],
      // En producción siempre Meta; en desarrollo y pruebas, uno falso que no manda nada.
      useFactory: (config: ConfigService) => (config.get<string>('NODE_ENV') === 'production' ? new MetaWhatsappClient() : new FakeWhatsappClient()),
    },
  ],
})
export class WhatsappModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OrderPaymentsController, WompiEventsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { WompiConfig } from './wompi.config.js';

@Module({
  imports: [AuthModule],
  controllers: [OrderPaymentsController, WompiEventsController],
  providers: [PaymentsService, WompiConfig],
  // Suscripciones cobra sus facturas con el mismo Wompi.
  exports: [WompiConfig, PaymentsService],
})
export class PaymentsModule {}

import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { AlertsDailyService } from './alerts-daily.service.js';
import { AlertsController, InternalAlertsController } from './alerts.controller.js';
import { AlertsService } from './alerts.service.js';

/** Global: tickets, solicitudes, comunicados y documentos crean avisos con AlertsService. */
@Global()
@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [AlertsController, InternalAlertsController],
  providers: [AlertsService, AlertsDailyService],
  exports: [AlertsService],
})
export class AlertsModule {}

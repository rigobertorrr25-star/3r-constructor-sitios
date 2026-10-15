import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { AdminBillingController, CompanyBillingController, InternalBillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';

@Module({
  imports: [AuthModule, CompaniesModule, PaymentsModule],
  controllers: [CompanyBillingController, AdminBillingController, InternalBillingController],
  providers: [BillingService],
})
export class BillingModule {}

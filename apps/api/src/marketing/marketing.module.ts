import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { MarketingController, PublicMarketingController } from './marketing.controller.js';
import { MarketingService } from './marketing.service.js';

@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [MarketingController, PublicMarketingController],
  providers: [MarketingService],
})
export class MarketingModule {}

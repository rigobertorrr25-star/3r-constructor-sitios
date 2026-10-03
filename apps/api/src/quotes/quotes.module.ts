import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { PublicQuotesController, QuotesController } from './quotes.controller.js';
import { QuotesService } from './quotes.service.js';

@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [QuotesController, PublicQuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}

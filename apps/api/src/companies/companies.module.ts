import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminCompaniesController, CompaniesController, CompanyInvitesController } from './companies.controller.js';
import { CompaniesService } from './companies.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CompaniesController, CompanyInvitesController, AdminCompaniesController],
  providers: [CompaniesService],
  // Los módulos (CRM, tickets…) usan requireMember / requireModule.
  exports: [CompaniesService],
})
export class CompaniesModule {}

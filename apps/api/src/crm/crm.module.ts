import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { CrmController } from './crm.controller.js';
import { CrmService } from './crm.service.js';

@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [CrmController],
  providers: [CrmService],
})
export class CrmModule {}

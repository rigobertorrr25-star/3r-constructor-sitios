import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { MediaModule } from '../media/media.module.js';
import { PublishingModule } from '../publishing/publishing.module.js';
import { AdminCompanyWebController, CompanyWebController } from './company-web.controller.js';
import { CompanyWebService } from './company-web.service.js';

@Module({
  imports: [AuthModule, CompaniesModule, MediaModule, PublishingModule],
  controllers: [CompanyWebController, AdminCompanyWebController],
  providers: [CompanyWebService],
})
export class CompanyWebModule {}

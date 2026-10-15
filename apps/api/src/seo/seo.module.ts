import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { PublishingModule } from '../publishing/publishing.module.js';
import { SeoController } from './seo.controller.js';
import { SeoService } from './seo.service.js';

@Module({
  imports: [AuthModule, CompaniesModule, PublishingModule],
  controllers: [SeoController],
  providers: [SeoService],
})
export class SeoModule {}

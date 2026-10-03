import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { AiContentController } from './ai-content.controller.js';
import { AiContentService } from './ai-content.service.js';

@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [AiContentController],
  providers: [AiContentService],
})
export class AiContentModule {}

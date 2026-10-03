import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { KnowledgeController, PublicHelpController } from './knowledge.controller.js';
import { KnowledgeService } from './knowledge.service.js';

@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [KnowledgeController, PublicHelpController],
  providers: [KnowledgeService],
})
export class KnowledgeModule {}

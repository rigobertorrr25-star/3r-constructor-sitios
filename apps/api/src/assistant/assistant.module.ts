import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';

@Module({
  imports: [AuthModule, CompaniesModule, DocumentsModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}

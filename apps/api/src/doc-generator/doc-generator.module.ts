import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { DocGeneratorController } from './doc-generator.controller.js';
import { DocGeneratorService } from './doc-generator.service.js';

@Module({
  imports: [AuthModule, CompaniesModule, DocumentsModule],
  controllers: [DocGeneratorController],
  providers: [DocGeneratorService],
})
export class DocGeneratorModule {}

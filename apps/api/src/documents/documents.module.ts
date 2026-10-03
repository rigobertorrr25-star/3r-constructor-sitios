import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { DOCUMENT_STORAGE } from './document-storage.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { LocalDocumentStorage } from './local-document-storage.js';
import { LocalFilesController } from './local-files.controller.js';
import { R2DocumentStorage } from './r2-document-storage.js';

@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [DocumentsController, LocalFilesController],
  providers: [
    DocumentsService,
    {
      provide: DOCUMENT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const bucket = config.get<string>('R2_DOCS_BUCKET') || config.get<string>('R2_BUCKET');
        const accountId = config.get<string>('R2_ACCOUNT_ID');
        const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
        const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');
        if (bucket && accountId && accessKeyId && secretAccessKey) return new R2DocumentStorage(bucket, accountId, accessKeyId, secretAccessKey);
        // Sin R2: disco del servidor (desarrollo). En producción hace falta R2: el disco de Render no es permanente.
        return new LocalDocumentStorage(config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-secret');
      },
    },
  ],
})
export class DocumentsModule {}

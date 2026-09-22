import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { PublicSitesController, PublishingController } from './publishing.controller.js';
import { PublishingService } from './publishing.service.js';
import { R2PublishStorage } from './r2-storage.js';
import { LocalPublishStorage, PUBLISH_STORAGE } from './storage.js';

@Module({
  imports: [AuthModule],
  controllers: [PublishingController, PublicSitesController],
  providers: [
    PublishingService,
    {
      provide: PUBLISH_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const bucket = config.get<string>('R2_BUCKET');
        const accountId = config.get<string>('R2_ACCOUNT_ID');
        const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
        const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');
        // Sin las 4 variables de R2, se usa disco local (perfecto para desarrollo; en un hosting con
        // disco temporal como Render, hay que configurar R2 para que los sitios publicados no se pierdan).
        if (bucket && accountId && accessKeyId && secretAccessKey) {
          return new R2PublishStorage(bucket, accountId, accessKeyId, secretAccessKey);
        }
        return new LocalPublishStorage(config.get<string>('PUBLISH_DIR'));
      },
    },
  ],
  exports: [PublishingService],
})
export class PublishingModule {}

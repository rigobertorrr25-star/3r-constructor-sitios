import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { PublicSitesController, PublishingController } from './publishing.controller.js';
import { PublishingService } from './publishing.service.js';
import { LocalPublishStorage, PUBLISH_STORAGE } from './storage.js';

@Module({
  imports: [AuthModule],
  controllers: [PublishingController, PublicSitesController],
  providers: [
    PublishingService,
    {
      provide: PUBLISH_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new LocalPublishStorage(config.get<string>('PUBLISH_DIR')),
    },
  ],
  exports: [PublishingService],
})
export class PublishingModule {}

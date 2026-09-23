import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { LocalMediaController, MediaController } from './media.controller.js';
import { LocalMediaStorage } from './local-media-storage.js';
import { MEDIA_STORAGE } from './media-storage.js';
import { R2MediaStorage } from './r2-media-storage.js';

@Module({
  imports: [AuthModule],
  controllers: [MediaController, LocalMediaController],
  providers: [
    {
      provide: MEDIA_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const bucket = config.get<string>('R2_BUCKET');
        const accountId = config.get<string>('R2_ACCOUNT_ID');
        const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
        const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');
        const publicBase = config.get<string>('R2_PUBLIC_BASE_URL');
        if (bucket && accountId && accessKeyId && secretAccessKey && publicBase) {
          return new R2MediaStorage(bucket, accountId, accessKeyId, secretAccessKey, publicBase);
        }
        // Sin R2 (o sin su URL pública), se guarda en el disco del servidor: perfecto para
        // desarrollo; en producción sin R2, los archivos no sobreviven a un reinicio (igual que
        // los sitios publicados — ver PublishingModule).
        const secret = config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-secret';
        return new LocalMediaStorage(secret);
      },
    },
  ],
})
export class MediaModule {}

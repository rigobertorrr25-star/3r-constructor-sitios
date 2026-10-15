import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { MediaModule } from '../media/media.module.js';
import { PublicStoreController, StoreController } from './store.controller.js';
import { StoreService } from './store.service.js';

@Module({
  imports: [AuthModule, CompaniesModule, MediaModule],
  controllers: [StoreController, PublicStoreController],
  providers: [StoreService],
})
export class StoreModule {}

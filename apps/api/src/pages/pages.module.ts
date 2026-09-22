import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PagesController } from './pages.controller.js';
import { PagesService } from './pages.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}

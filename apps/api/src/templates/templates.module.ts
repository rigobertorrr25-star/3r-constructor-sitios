import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TemplatesController } from './templates.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [TemplatesController],
})
export class TemplatesModule {}

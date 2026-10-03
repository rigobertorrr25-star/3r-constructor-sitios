import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { TrainingController } from './training.controller.js';
import { TrainingService } from './training.service.js';

@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [TrainingController],
  providers: [TrainingService],
})
export class TrainingModule {}

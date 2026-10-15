import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { PublicSurveysController, SurveysController } from './surveys.controller.js';
import { SurveysService } from './surveys.service.js';

@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [SurveysController, PublicSurveysController],
  providers: [SurveysService],
})
export class SurveysModule {}

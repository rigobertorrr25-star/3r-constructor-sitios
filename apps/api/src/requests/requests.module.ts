import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { RequestsController } from './requests.controller.js';
import { RequestsService } from './requests.service.js';

@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}

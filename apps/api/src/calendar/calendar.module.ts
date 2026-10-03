import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { CalendarController } from './calendar.controller.js';
import { CalendarService } from './calendar.service.js';

@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}

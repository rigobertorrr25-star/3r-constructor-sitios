import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminAttendanceController, AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AttendanceController, AdminAttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}

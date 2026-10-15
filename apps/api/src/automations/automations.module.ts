import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CompaniesModule } from '../companies/companies.module.js';
import { AutomationsController } from './automations.controller.js';
import { AutomationsService } from './automations.service.js';

/** Global: los demás módulos le avisan lo que pasa con `automations.emit(...)`. */
@Global()
@Module({
  imports: [AuthModule, CompaniesModule],
  controllers: [AutomationsController],
  providers: [AutomationsService],
  exports: [AutomationsService],
})
export class AutomationsModule {}

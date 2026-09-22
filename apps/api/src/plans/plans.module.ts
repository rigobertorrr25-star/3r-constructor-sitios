import { Global, Module } from '@nestjs/common';
import { PlansService } from './plans.service.js';

@Global()
@Module({
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}

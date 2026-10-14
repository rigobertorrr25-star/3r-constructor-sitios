import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminLoyaltyController } from './admin-loyalty.controller.js';
import { LoyaltyBootstrap } from './loyalty-bootstrap.js';
import { LoyaltyOwnerController } from './loyalty-owner.controller.js';
import { LoyaltyOwnerService } from './loyalty-owner.service.js';
import { LoyaltyController } from './loyalty.controller.js';
import { LoyaltyService } from './loyalty.service.js';

@Module({
  imports: [AuthModule],
  controllers: [LoyaltyController, LoyaltyOwnerController, AdminLoyaltyController],
  providers: [LoyaltyService, LoyaltyOwnerService, LoyaltyBootstrap],
})
export class LoyaltyModule {}

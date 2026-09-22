import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SitesModule } from '../sites/sites.module.js';
import { AdminOrdersController } from './admin-orders.controller.js';
import { AdminOrdersService } from './admin-orders.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [AuthModule, SitesModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, AdminOrdersService],
})
export class OrdersModule {}

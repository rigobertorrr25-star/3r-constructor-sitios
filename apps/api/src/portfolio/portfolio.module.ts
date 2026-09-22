import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminPortfolioController, PortfolioController } from './portfolio.controller.js';
import { PortfolioService } from './portfolio.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PortfolioController, AdminPortfolioController],
  providers: [PortfolioService],
})
export class PortfolioModule {}

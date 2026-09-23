import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { EmailModule } from './email/email.module.js';
import { HealthController } from './health/health.controller.js';
import { MediaModule } from './media/media.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PackagesModule } from './packages/packages.module.js';
import { PagesModule } from './pages/pages.module.js';
import { PortfolioModule } from './portfolio/portfolio.module.js';
import { PublishingModule } from './publishing/publishing.module.js';
import { PlansModule } from './plans/plans.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SitesModule } from './sites/sites.module.js';
import { TemplatesModule } from './templates/templates.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Límite general por IP; los endpoints sensibles de /auth tienen uno más estricto (ver AuthController).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    EmailModule,
    PlansModule,
    UsersModule,
    AuthModule,
    AdminModule,
    TemplatesModule,
    SitesModule,
    PagesModule,
    PackagesModule,
    OrdersModule,
    PortfolioModule,
    PublishingModule,
    MediaModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

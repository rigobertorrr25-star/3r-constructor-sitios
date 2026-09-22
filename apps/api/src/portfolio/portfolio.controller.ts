import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Role } from '../common/roles.js';
import { CreatePortfolioItemDto, UpdatePortfolioItemDto } from './dto/portfolio.dto.js';
import { PortfolioService } from './portfolio.service.js';

/** Trabajos realizados: los ve cualquier visitante en la portada. */
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  list() {
    return this.portfolio.listPublic();
  }
}

@Controller('admin/portfolio')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminPortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  list() {
    return this.portfolio.listAll();
  }

  @Post()
  create(@CurrentUser() admin: AuthUser, @Body() dto: CreatePortfolioItemDto, @Req() req: { ip?: string }) {
    return this.portfolio.create(admin.id, dto, req.ip);
  }

  @Patch(':itemId')
  update(
    @CurrentUser() admin: AuthUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdatePortfolioItemDto,
    @Req() req: { ip?: string },
  ) {
    return this.portfolio.update(admin.id, itemId, dto, req.ip);
  }

  @Delete(':itemId')
  @HttpCode(204)
  async remove(
    @CurrentUser() admin: AuthUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Req() req: { ip?: string },
  ) {
    await this.portfolio.remove(admin.id, itemId, req.ip);
  }
}

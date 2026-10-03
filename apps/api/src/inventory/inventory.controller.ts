import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt.guard.js';
import { AssetStatusDto, AssignDto, MovementDto, SaveAssetDto, SaveItemDto } from './dto/inventory.dto.js';
import { InventoryService } from './inventory.service.js';

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** Inventario de productos e insumos, y equipos entregados al personal. */
@Controller('companies/:companyId/inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.inventory.summary(user.id, companyId);
  }

  @Get('items')
  listItems(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('q') q?: string,
    @Query('filter') filter?: string,
  ) {
    return this.inventory.listItems(user.id, companyId, str(q), str(filter));
  }

  @Post('items')
  createItem(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: SaveItemDto) {
    return this.inventory.createItem(user.id, companyId, dto);
  }

  @Get('items/:itemId')
  getItem(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.inventory.getItem(user.id, companyId, itemId);
  }

  @Put('items/:itemId')
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: SaveItemDto,
  ) {
    return this.inventory.updateItem(user.id, companyId, itemId, dto);
  }

  @Delete('items/:itemId')
  @HttpCode(204)
  removeItem(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.inventory.removeItem(user.id, companyId, itemId);
  }

  @Post('items/:itemId/movements')
  move(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: MovementDto,
  ) {
    return this.inventory.move(user.id, companyId, itemId, dto);
  }

  @Get('assets')
  listAssets(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.inventory.listAssets(user.id, companyId, str(status), str(q));
  }

  @Post('assets')
  createAsset(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Body() dto: SaveAssetDto) {
    return this.inventory.createAsset(user.id, companyId, dto);
  }

  @Get('members/:memberId/assets')
  memberAssets(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.inventory.memberAssets(user.id, companyId, memberId);
  }

  @Get('assets/:assetId')
  getAsset(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('assetId', ParseUUIDPipe) assetId: string) {
    return this.inventory.getAsset(user.id, companyId, assetId);
  }

  @Put('assets/:assetId')
  updateAsset(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() dto: SaveAssetDto,
  ) {
    return this.inventory.updateAsset(user.id, companyId, assetId, dto);
  }

  @Delete('assets/:assetId')
  @HttpCode(204)
  removeAsset(@CurrentUser() user: AuthUser, @Param('companyId', ParseUUIDPipe) companyId: string, @Param('assetId', ParseUUIDPipe) assetId: string) {
    return this.inventory.removeAsset(user.id, companyId, assetId);
  }

  @Post('assets/:assetId/assign')
  @HttpCode(200)
  assign(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() dto: AssignDto,
  ) {
    return this.inventory.assign(user.id, companyId, assetId, dto);
  }

  @Post('assets/:assetId/status')
  @HttpCode(200)
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() dto: AssetStatusDto,
  ) {
    return this.inventory.setStatus(user.id, companyId, assetId, dto);
  }
}

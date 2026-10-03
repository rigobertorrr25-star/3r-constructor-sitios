import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { MOVEMENT_TYPES, UNITS } from '../inventory.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const qty = { maxDecimalPlaces: 3 };

export class SaveItemDto {
  @Transform(trim) @IsString() @MinLength(2, { message: 'Escribe el nombre del producto' }) @MaxLength(150) name!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) sku?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) category?: string;
  @IsIn(UNITS) unit!: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber(qty) @Min(0) @Max(1e10) minStock?: number | null;
  /** Costo de una unidad, en pesos. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber({ maxDecimalPlaces: 0 }) @Min(0) @Max(1e12) cost?: number | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) location?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  /** Solo al crear: con cuánto arranca. */
  @IsOptional() @IsNumber(qty) @Min(0) @Max(1e10) initialStock?: number;
}

export class MovementDto {
  @IsIn(MOVEMENT_TYPES) type!: string;
  @IsNumber(qty, { message: 'Escribe una cantidad válida (hasta 3 decimales)' }) @Min(0) @Max(1e10) quantity!: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) note?: string;
}

export class SaveAssetDto {
  @Transform(trim) @IsString() @MinLength(2, { message: 'Escribe el nombre del equipo' }) @MaxLength(150) name!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) code?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) category?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) serial?: string;
  /** Valor en pesos. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber({ maxDecimalPlaces: 0 }) @Min(0) @Max(1e12) value?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsISO8601({ strict: true }) purchasedAt?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) notes?: string;
}

export class AssignDto {
  @IsUUID() memberId!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) note?: string;
}

export class AssetStatusDto {
  /** Devolver (available), mandar a reparación o dar de baja. */
  @IsIn(['available', 'repair', 'retired']) status!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) note?: string;
}

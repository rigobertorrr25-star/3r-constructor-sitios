import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DELIVERY, MAX_LINES, ORDER_STATUSES, SLUG } from '../store.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const PESOS = 1e10;

export class StoreSettingsDto {
  @Transform(lower)
  @Matches(SLUG, { message: 'La dirección va en minúsculas, sin tildes ni espacios (puedes usar guiones): cafe-la-muralla' })
  slug!: string;
  @Transform(trim) @IsString() @MinLength(2, { message: 'Escribe el nombre de la tienda' }) @MaxLength(120) name!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) tagline?: string;
  @IsOptional() @Transform(trim) @IsString() @Matches(/^[+\d\s()-]{0,30}$/, { message: 'Escribe el WhatsApp solo con números' }) whatsapp?: string;
  @IsOptional() @IsBoolean() open?: boolean;
  @IsBoolean() pickupEnabled!: boolean;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) pickupNote?: string;
  @IsBoolean() deliveryEnabled!: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(PESOS) deliveryFee?: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(PESOS) freeFrom?: number | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) deliveryNote?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) paymentNote?: string;
}

export class VariantDto {
  @IsOptional() @IsUUID() id?: string;
  @Transform(trim) @IsString() @MinLength(1, { message: 'Escribe el nombre de cada opción' }) @MaxLength(80) name!: string;
  /** Vacío = el precio del producto. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(PESOS) price?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(1e7) stock?: number | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class SaveProductDto {
  @Transform(trim) @IsString() @MinLength(2, { message: 'Escribe el nombre del producto' }) @MaxLength(150) name!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(5000) description?: string;
  @IsInt({ message: 'Escribe el precio en pesos' }) @Min(0) @Max(PESOS) price!: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(PESOS) compareAt?: number | null;
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, v) => v !== '' && v !== null)
  @Matches(/^https?:\/\/\S+$/, { message: 'La foto debe ser un enlace https://' })
  @MaxLength(500)
  imageUrl?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsBoolean() trackStock?: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(1e7) stock?: number | null;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => VariantDto) variants?: VariantDto[];
}

export class SaveCouponDto {
  @Transform(upper) @Matches(/^[A-Z0-9_-]{3,30}$/, { message: 'El código va de 3 a 30 letras o números, sin espacios' }) code!: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(100) percent?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(PESOS) amount?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(PESOS) minOrder?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(1) @Max(1e7) maxUses?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsISO8601({ strict: true }) expiresAt?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CartLineDto {
  @IsUUID() productId!: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() variantId?: string | null;
  @IsInt() @Min(1) @Max(99) qty!: number;
}

export class QuoteCartDto {
  @IsArray() @ArrayMaxSize(MAX_LINES) @ValidateNested({ each: true }) @Type(() => CartLineDto) items!: CartLineDto[];
  @IsOptional() @Transform(upper) @IsString() @MaxLength(30) coupon?: string;
  @IsIn(DELIVERY) delivery!: string;
}

export class PlaceOrderDto extends QuoteCartDto {
  @Transform(trim) @IsString() @MinLength(2, { message: 'Escribe tu nombre' }) @MaxLength(150) name!: string;
  @Transform(trim) @Matches(/^[+\d\s()-]{7,30}$/, { message: 'Escribe un celular válido' }) phone!: string;
  @IsOptional() @Transform(trim) @ValidateIf((_, v) => v !== '') @IsEmail({}, { message: 'Ese correo no es válido' }) @MaxLength(255) email?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) address?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) notes?: string;
}

export class UpdateOrderDto {
  @IsOptional() @IsIn(ORDER_STATUSES) status?: string;
  @IsOptional() @IsBoolean() paid?: boolean;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) staffNote?: string;
}

export class StoreImageDto {
  @IsIn(['image/png', 'image/jpeg', 'image/webp']) contentType!: string;
}

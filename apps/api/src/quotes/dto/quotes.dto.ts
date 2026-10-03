import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
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
import { MAX_ITEMS, TAX_RATES } from '../quotes.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class QuoteItemDto {
  @Transform(trim) @IsString() @MinLength(1, { message: 'Cada ítem necesita una descripción' }) @MaxLength(300) description!: string;
  @Type(() => Number) @IsInt({ message: 'La cantidad va sin decimales' }) @Min(1) @Max(1_000_000) quantity!: number;
  /** Pesos por unidad, sin centavos. */
  @Type(() => Number) @IsInt({ message: 'El precio va en pesos, sin decimales' }) @Min(0) @Max(10_000_000_000) unitPrice!: number;
}

export class SaveQuoteDto {
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsUUID() contactId?: string | null;
  @Transform(trim) @IsString() @MinLength(2, { message: 'Escribe el nombre del cliente' }) @MaxLength(150) clientName!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) clientCompany?: string;
  @IsOptional() @Transform(trim) @ValidateIf((_, v) => v !== '') @IsEmail({}, { message: 'Escribe un correo válido' }) @MaxLength(255) clientEmail?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50) clientPhone?: string;
  @Transform(trim) @IsString() @MinLength(2, { message: 'Ponle un título a la cotización' }) @MaxLength(150) title!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(4000) notes?: string;
  @IsArray() @ArrayMinSize(1, { message: 'Agrega al menos un ítem' }) @ArrayMaxSize(MAX_ITEMS) @ValidateNested({ each: true }) @Type(() => QuoteItemDto) items!: QuoteItemDto[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) discount?: number;
  @IsOptional() @Type(() => Number) @IsIn(TAX_RATES, { message: 'El IVA es 0, 5 o 19 %' }) taxRate?: number;
  @IsOptional() @Matches(/^(\d{4}-\d{2}-\d{2})?$/, { message: 'Escribe la fecha como AAAA-MM-DD' }) validUntil?: string;
}

export class RespondQuoteDto {
  @IsIn(['accept', 'reject', 'changes']) action!: string;
  @Transform(trim) @IsString() @MinLength(2, { message: 'Escribe tu nombre' }) @MaxLength(150) name!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) message?: string;
}

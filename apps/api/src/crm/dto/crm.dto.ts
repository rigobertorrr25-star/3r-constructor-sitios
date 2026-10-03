import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { CRM_ACTIVITY_KINDS, CRM_SOURCES, CRM_STAGES } from '../crm.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateContactDto {
  @Transform(trim) @IsString() @MinLength(2, { message: 'Escribe el nombre del cliente' }) @MaxLength(150) name!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) organization?: string;
  @IsOptional() @Transform(trim) @ValidateIf((_, v) => v !== '') @IsEmail({}, { message: 'Escribe un correo válido' }) @MaxLength(255) email?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsIn(CRM_STAGES) stage?: string;
  @IsOptional() @IsIn(CRM_SOURCES) source?: string;
  /** Pesos colombianos sin centavos (se guarda en centavos). */
  @IsOptional() @Type(() => Number) @IsInt({ message: 'El valor va en pesos, sin decimales' }) @Min(0) @Max(100_000_000_000) value?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsUUID() ownerMemberId?: string | null;
  /** Aceptó recibir promociones (Ley 1581). */
  @IsOptional() @IsBoolean() marketingOptIn?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(30, { each: true, message: 'Cada etiqueta puede tener hasta 30 letras' }) tags?: string[];
}

export class UpdateContactDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(150) name?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) organization?: string;
  @IsOptional() @Transform(trim) @ValidateIf((_, v) => v !== '') @IsEmail({}, { message: 'Escribe un correo válido' }) @MaxLength(255) email?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsIn(CRM_STAGES) stage?: string;
  @IsOptional() @IsIn(CRM_SOURCES) source?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsInt({ message: 'El valor va en pesos, sin decimales' }) @Min(0) @Max(100_000_000_000) value?: number | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsUUID() ownerMemberId?: string | null;
  /** Aceptó recibir promociones (Ley 1581). */
  @IsOptional() @IsBoolean() marketingOptIn?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(30, { each: true, message: 'Cada etiqueta puede tener hasta 30 letras' }) tags?: string[];
}

export class CreateActivityDto {
  @IsIn(CRM_ACTIVITY_KINDS) kind!: string;
  @Transform(trim) @IsString() @MinLength(1, { message: 'Escribe qué pasó' }) @MaxLength(4000) body!: string;
}

import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { TEMPLATES } from '../doc-generator.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class GenerateDocumentDto {
  @IsIn(TEMPLATES, { message: 'Elige qué documento vas a generar' }) template!: string;
  @IsUUID() memberId!: string;
  /** "A quien pueda interesar" si va vacío. */
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) addressee?: string;
  @IsOptional() @IsBoolean() includeSalary?: boolean;
  /** Constancia de vacaciones: la solicitud aprobada. */
  @IsOptional() @IsUUID() requestId?: string;
  /** Carta libre. */
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) subject?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(6000) body?: string;
  @Transform(trim) @IsString() @MinLength(2, { message: 'Escribe quién firma' }) @MaxLength(120) signerName!: string;
  @Transform(trim) @IsString() @MinLength(2, { message: 'Escribe el cargo de quien firma' }) @MaxLength(120) signerTitle!: string;
  /** Guardar una copia en la carpeta del empleado (si la empresa tiene Documentos). */
  @IsOptional() @IsBoolean() saveToFolder?: boolean;
}

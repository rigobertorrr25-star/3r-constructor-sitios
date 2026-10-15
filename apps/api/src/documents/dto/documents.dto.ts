import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DOCUMENT_MAX_BYTES, DOCUMENT_TYPES } from '../document-storage.js';
import { AUDIENCES, DOCUMENT_CATEGORIES } from '../documents.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const DATE = /^(\d{4}-\d{2}-\d{2})?$/;

export class RequestUploadDto {
  @Transform(trim) @IsString() @MinLength(2, { message: 'Ponle un nombre al documento' }) @MaxLength(150) title!: string;
  @IsIn(DOCUMENT_CATEGORIES, { message: 'Elige qué tipo de documento es' }) category!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(200) fileName!: string;
  @IsIn(Object.keys(DOCUMENT_TYPES), { message: 'Ese tipo de archivo no se admite. Usa PDF, imagen, Word o Excel.' }) contentType!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(DOCUMENT_MAX_BYTES, { message: 'El archivo pesa más de 20 MB.' }) size!: number;
  /** Sin valor: documento de la empresa. */
  @IsOptional() @IsUUID() memberId?: string;
  @IsOptional() @IsIn(AUDIENCES) audience?: string;
  @IsOptional() @Matches(DATE, { message: 'Escribe la fecha como AAAA-MM-DD' }) expiresOn?: string;
}

export class UpdateDocumentDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(150) title?: string;
  @IsOptional() @IsIn(DOCUMENT_CATEGORIES) category?: string;
  @IsOptional() @IsIn(AUDIENCES) audience?: string;
  @IsOptional() @Matches(DATE, { message: 'Escribe la fecha como AAAA-MM-DD' }) expiresOn?: string;
}

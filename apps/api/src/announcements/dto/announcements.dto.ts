import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { ANNOUNCEMENT_KINDS } from '../announcements.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateAnnouncementDto {
  @IsOptional() @IsIn(ANNOUNCEMENT_KINDS) kind?: string;
  @Transform(trim) @IsString() @MinLength(3, { message: 'Escribe un título' }) @MaxLength(150) title!: string;
  @Transform(trim) @IsString() @MinLength(3, { message: 'Escribe el comunicado' }) @MaxLength(10000) body!: string;
  /** Fecha y hora del evento (ISO). '' o null la borra. */
  @IsOptional() @ValidateIf((_, v) => v !== '' && v !== null) @IsISO8601({}, { message: 'Fecha del evento no válida' }) eventAt?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) eventPlace?: string;
  @IsOptional() @IsBoolean() pinned?: boolean;
  /** Avisar por correo a todo el equipo al publicar. */
  @IsOptional() @IsBoolean() notify?: boolean;
}

export class UpdateAnnouncementDto {
  @IsOptional() @IsIn(ANNOUNCEMENT_KINDS) kind?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(3) @MaxLength(150) title?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(3) @MaxLength(10000) body?: string;
  @IsOptional() @ValidateIf((_, v) => v !== '' && v !== null) @IsISO8601({}, { message: 'Fecha del evento no válida' }) eventAt?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) eventPlace?: string;
  @IsOptional() @IsBoolean() pinned?: boolean;
}

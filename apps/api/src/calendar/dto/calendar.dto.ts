import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { EVENT_KINDS } from '../calendar.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateEventDto {
  @IsOptional() @IsIn(EVENT_KINDS) kind?: string;
  @Transform(trim) @IsString() @MinLength(2, { message: 'Escribe un título' }) @MaxLength(150) title!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) location?: string;
  @IsISO8601({}, { message: 'Elige cuándo empieza' }) startsAt!: string;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsISO8601() endsAt?: string | null;
  @IsOptional() @IsBoolean() allDay?: boolean;
  /** Recordatorio solo para mí. */
  @IsOptional() @IsBoolean() personal?: boolean;
}

export class UpdateEventDto {
  @IsOptional() @IsIn(EVENT_KINDS) kind?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(150) title?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) location?: string;
  @IsOptional() @IsISO8601() startsAt?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsISO8601() endsAt?: string | null;
  @IsOptional() @IsBoolean() allDay?: boolean;
}

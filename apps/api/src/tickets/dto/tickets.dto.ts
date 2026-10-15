import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../tickets.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateTicketDto {
  @Transform(trim) @IsString() @MinLength(4, { message: 'Escribe un título corto de lo que pasa' }) @MaxLength(150) title!: string;
  @Transform(trim) @IsString() @MinLength(5, { message: 'Cuenta un poco más de lo que necesitas' }) @MaxLength(8000) description!: string;
  @IsIn(TICKET_CATEGORIES, { message: 'Elige a qué área va' }) category!: string;
  @IsOptional() @IsIn(TICKET_PRIORITIES) priority?: string;
}

export class UpdateTicketDto {
  @IsOptional() @IsIn(TICKET_STATUSES) status?: string;
  @IsOptional() @IsIn(TICKET_PRIORITIES) priority?: string;
  @IsOptional() @IsIn(TICKET_CATEGORIES) category?: string;
  /** null o '' lo deja sin responsable. */
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsUUID() assigneeMemberId?: string | null;
}

export class CreateCommentDto {
  @Transform(trim) @IsString() @MinLength(1, { message: 'Escribe el comentario' }) @MaxLength(4000) body!: string;
}

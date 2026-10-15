import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AUDIENCES, STATUSES } from '../knowledge.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SaveArticleDto {
  @Transform(trim) @IsString() @MinLength(3, { message: 'Ponle un título al artículo' }) @MaxLength(150) title!: string;
  @Transform(trim) @IsString() @MinLength(10, { message: 'Escribe el contenido del artículo' }) @MaxLength(50000) body!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) category?: string;
  @IsIn(AUDIENCES) audience!: string;
  @IsIn(STATUSES) status!: string;
  @IsOptional() @IsBoolean() pinned?: boolean;
}

export class VoteDto {
  @IsBoolean() helpful!: boolean;
}

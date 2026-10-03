import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class PageMetaDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120, { message: 'El título para Google va hasta 120 letras (lo ideal es 25 a 65)' })
  seoTitle?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300, { message: 'La descripción va hasta 300 letras (lo ideal es 70 a 160)' })
  seoDescription?: string;
}

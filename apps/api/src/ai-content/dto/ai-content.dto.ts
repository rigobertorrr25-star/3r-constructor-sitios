import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { KIND_KEYS, TONE_KEYS } from '../ai-content.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class GenerateDto {
  @IsIn(KIND_KEYS) kind!: string;
  @IsOptional() @IsIn(TONE_KEYS) tone?: string;
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Cuéntale a la IA de qué se trata' })
  @MaxLength(1000, { message: 'Es muy largo: resúmelo un poco' })
  topic!: string;
}

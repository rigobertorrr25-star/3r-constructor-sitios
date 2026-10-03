import { Transform } from 'class-transformer';
import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AskDto {
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Escribe tu pregunta' })
  @MaxLength(1000, { message: 'La pregunta es muy larga' })
  question!: string;
}

export class FeedbackDto {
  @IsBoolean() helpful!: boolean;
}

export class DocumentAiDto {
  @IsBoolean() enabled!: boolean;
}

import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AUDIENCES, MAX_OPTIONS, MAX_QUESTIONS, QUESTION_KINDS } from '../surveys.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class QuestionDto {
  @IsIn(QUESTION_KINDS) kind!: string;
  @Transform(trim) @IsString() @MinLength(2, { message: 'Escribe cada pregunta' }) @MaxLength(300) text!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_OPTIONS) @IsString({ each: true }) @MaxLength(120, { each: true }) options?: string[];
  @IsOptional() @IsBoolean() required?: boolean;
}

export class SaveSurveyDto {
  @Transform(trim) @IsString() @MinLength(3, { message: 'Ponle un título a la encuesta' }) @MaxLength(150) title!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) description?: string;
  @IsIn(AUDIENCES) audience!: string;
  @IsOptional() @IsBoolean() anonymous?: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsISO8601() closesAt?: string | null;
  @IsArray() @ArrayMinSize(1, { message: 'Agrega al menos una pregunta' }) @ArrayMaxSize(MAX_QUESTIONS) @ValidateNested({ each: true }) @Type(() => QuestionDto) questions!: QuestionDto[];
}

export class AnswerDto {
  /** { [questionId]: number | string | string[] } */
  @IsObject() answers!: Record<string, unknown>;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) name?: string;
}

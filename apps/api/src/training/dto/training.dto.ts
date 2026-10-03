import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MAX_LESSONS, MAX_OPTIONS, MAX_QUESTIONS } from '../training.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class LessonDto {
  /** Si viene, se actualiza esa lección (y no se pierde el avance de quienes ya la vieron). */
  @IsOptional() @IsUUID() id?: string;
  @Transform(trim) @IsString() @MinLength(2, { message: 'Ponle un título a cada lección' }) @MaxLength(150) title!: string;
  @Transform(trim) @IsString() @MinLength(2, { message: 'Escribe el contenido de cada lección' }) @MaxLength(20000) body!: string;
  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, v) => v !== '' && v !== null)
  @Matches(/^https:\/\/\S+$/, { message: 'El enlace del video debe empezar por https://' })
  @MaxLength(500)
  videoUrl?: string | null;
}

export class CourseQuestionDto {
  @Transform(trim) @IsString() @MinLength(2, { message: 'Escribe cada pregunta' }) @MaxLength(300) text!: string;
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(MAX_OPTIONS) @IsString({ each: true }) @MaxLength(200, { each: true }) options!: string[];
  @IsInt() @Min(0) correct!: number;
}

export class SaveCourseDto {
  @Transform(trim) @IsString() @MinLength(3, { message: 'Ponle un título al curso' }) @MaxLength(150) title!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsISO8601({ strict: true }) dueAt?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(100) passScore?: number;
  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos una lección' })
  @ArrayMaxSize(MAX_LESSONS)
  @ValidateNested({ each: true })
  @Type(() => LessonDto)
  lessons!: LessonDto[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_QUESTIONS)
  @ValidateNested({ each: true })
  @Type(() => CourseQuestionDto)
  questions?: CourseQuestionDto[];
}

export class QuizDto {
  /** { [questionId]: índice de la opción elegida } */
  @IsObject() answers!: Record<string, unknown>;
}

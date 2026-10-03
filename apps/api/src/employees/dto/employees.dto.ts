import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { CONTRACT_TYPES, DOCUMENT_TYPES } from '../employees.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const DATE = /^(\d{4}-\d{2}-\d{2})?$/;
const DATE_MSG = { message: 'Escribe la fecha como AAAA-MM-DD' };

/** Todo opcional; '' borra el dato. */
export class UpdateProfileDto {
  @IsOptional() @ValidateIf((_, v) => v !== '') @IsIn(DOCUMENT_TYPES) documentType?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) documentNumber?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsBoolean() showPhone?: boolean;
  @IsOptional() @Matches(DATE, DATE_MSG) birthDate?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) address?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) city?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) emergencyName?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50) emergencyPhone?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) emergencyRelation?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) eps?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) pensionFund?: string;

  @IsOptional() @ValidateIf((_, v) => v !== '') @IsIn(CONTRACT_TYPES) contractType?: string;
  @IsOptional() @Matches(DATE, DATE_MSG) contractEnd?: string;
  /** Pesos al mes, sin centavos. null lo borra. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsInt({ message: 'El salario va en pesos, sin decimales' }) @Min(0) @Max(2_000_000_000) salary?: number | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) schedule?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(4000) hrNotes?: string;
}

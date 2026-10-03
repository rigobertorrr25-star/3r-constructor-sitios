import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { REQUEST_TYPES } from '../requests.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const DATE = /^(\d{4}-\d{2}-\d{2})?$/;
const DATE_MSG = { message: 'Escribe la fecha como AAAA-MM-DD' };

export class CreateRequestDto {
  @IsIn(REQUEST_TYPES, { message: 'Elige qué vas a pedir' }) type!: string;
  @IsOptional() @Matches(DATE, DATE_MSG) startDate?: string;
  @IsOptional() @Matches(DATE, DATE_MSG) endDate?: string;
  @Transform(trim) @IsString() @MinLength(3, { message: 'Cuenta brevemente el motivo' }) @MaxLength(2000) reason!: string;
}

export class DecideRequestDto {
  @IsIn(['approve', 'reject']) decision!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) note?: string;
}

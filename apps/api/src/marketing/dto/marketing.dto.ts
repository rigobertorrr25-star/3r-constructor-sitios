import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, Equals, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { CRM_SOURCES, CRM_STAGES } from '../../crm/crm.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** A quién le llega. Vacío = todos los que aceptaron recibir promociones. */
export class SegmentDto {
  @IsOptional() @IsArray() @ArrayMaxSize(CRM_STAGES.length) @IsIn(CRM_STAGES, { each: true }) stages?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(CRM_SOURCES.length) @IsIn(CRM_SOURCES, { each: true }) sources?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(30, { each: true }) tags?: string[];
}

export class SaveCampaignDto {
  @Transform(trim) @IsString() @MinLength(2, { message: 'Ponle un nombre a la campaña' }) @MaxLength(120) name!: string;
  @Transform(trim) @IsString() @MinLength(3, { message: 'Escribe el asunto del correo' }) @MaxLength(150) subject!: string;
  @Transform(trim) @IsString() @MinLength(10, { message: 'Escribe el mensaje del correo' }) @MaxLength(20000) body!: string;
  @IsOptional() @ValidateNested() @Type(() => SegmentDto) segment?: SegmentDto;
}

export class SubscribeDto {
  @Transform(trim) @IsString() @MinLength(2, { message: 'Escribe tu nombre' }) @MaxLength(150) name!: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Revisa tu correo' })
  @MaxLength(255)
  email!: string;
  @IsBoolean() @Equals(true, { message: 'Para suscribirte debes aceptar recibir los correos' }) consent!: boolean;
}

import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ACTION_TYPES, TRIGGER_KEYS } from '../automations.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ActionDto {
  @IsIn(ACTION_TYPES) type!: string;
  /** notify: supervisors | admins | everyone | id de una persona. email: correo. */
  @ValidateIf((o: ActionDto) => o.type === 'notify' || o.type === 'email') @Transform(trim) @IsString() @MaxLength(255) to?: string;
  /** Título de la alerta, asunto del correo o título del ticket (con {campos}). */
  @ValidateIf((o: ActionDto) => o.type !== 'crm_contact')
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Escribe el título de cada acción' })
  @MaxLength(150)
  title?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) body?: string;
  @IsOptional() @IsIn(['low', 'medium', 'high', 'urgent']) priority?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsUUID() assigneeMemberId?: string | null;
}

export class SaveAutomationDto {
  @Transform(trim) @IsString() @MinLength(3, { message: 'Ponle un nombre a la automatización' }) @MaxLength(120) name!: string;
  @IsIn(TRIGGER_KEYS) trigger!: string;
  /** Solo si el valor es al menos esto, en pesos (pedidos y cotizaciones). */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(1e10) minAmount?: number | null;
  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos una acción' })
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions!: ActionDto[];
  @IsOptional() @IsBoolean() active?: boolean;
}

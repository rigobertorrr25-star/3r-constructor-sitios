import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const PIN = /^\d{4,8}$/;
const PIN_MESSAGE = 'El código debe tener entre 4 y 8 números';

// ── Tarjeta del cliente ──

export class RegisterCustomerDto {
  @IsString()
  @MinLength(2, { message: 'Escribe tu nombre' })
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(30)
  phone!: string;

  @Equals(true, { message: 'Debes aceptar el uso de tus datos para crear la tarjeta' })
  consent!: boolean;
}

export class PinDto {
  @IsString()
  @Matches(PIN, { message: PIN_MESSAGE })
  pin!: string;
}

export class RecoverCardDto extends PinDto {
  @IsString()
  @MaxLength(30)
  phone!: string;
}

// ── Panel del dueño ──

export class OwnerLoginDto {
  @IsString()
  @MaxLength(200)
  key!: string;
}

export class ChangeOwnerKeyDto {
  @IsString()
  @MaxLength(200)
  current!: string;

  @IsString()
  @MinLength(8, { message: 'La clave nueva debe tener al menos 8 caracteres' })
  @MaxLength(200)
  next!: string;
}

export class CreateStaffDto {
  @IsString()
  @MinLength(2, { message: 'Escribe el nombre del mesero' })
  @MaxLength(60)
  name!: string;

  @IsString()
  @Matches(PIN, { message: PIN_MESSAGE })
  pin!: string;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(PIN, { message: PIN_MESSAGE })
  pin?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── Equipo de 3R: alta de programas ──

export class RewardDto {
  @IsInt()
  @Min(1)
  @Max(50)
  at!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  label!: string;
}

export class CreateProgramDto {
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'El identificador solo lleva minúsculas, números y guiones' })
  @MaxLength(60)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(2)
  @Max(50)
  goal!: number;

  @IsInt()
  @Min(0)
  @Max(7 * 24 * 60)
  cooldownMinutes!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => RewardDto)
  rewards!: RewardDto[];

  @IsString()
  @MinLength(8, { message: 'La clave del dueño debe tener al menos 8 caracteres' })
  @MaxLength(200)
  ownerKey!: string;
}

export class UpdateProgramDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(50)
  goal?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(7 * 24 * 60)
  cooldownMinutes?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => RewardDto)
  rewards?: RewardDto[];

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La clave del dueño debe tener al menos 8 caracteres' })
  @MaxLength(200)
  ownerKey?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

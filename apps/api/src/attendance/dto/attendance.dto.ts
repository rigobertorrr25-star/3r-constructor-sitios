import { IsBoolean, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_MESSAGE = 'La hora del turno debe tener el formato HH:MM (por ejemplo 08:00).';
const PIN = /^\d{4}$/;
const PIN_MESSAGE = 'El PIN debe tener exactamente 4 números.';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateBusinessDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Genera un enlace nuevo para la tablet; el anterior deja de funcionar. */
  @IsOptional()
  @IsBoolean()
  rotateKiosk?: boolean;
}

export class CreateEmployeeDto {
  @IsString()
  @MinLength(2, { message: 'Escribe el nombre del empleado.' })
  @MaxLength(120)
  name!: string;

  @Matches(PIN, { message: PIN_MESSAGE })
  pin!: string;

  @IsOptional()
  @Matches(TIME, { message: TIME_MESSAGE })
  shiftStart?: string;

  @IsOptional()
  @Matches(TIME, { message: TIME_MESSAGE })
  shiftEnd?: string;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Escribe el nombre del empleado.' })
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Matches(PIN, { message: PIN_MESSAGE })
  pin?: string;

  /** Cadena vacía para quitar el turno. */
  @IsOptional()
  @Matches(/^$|^([01]\d|2[0-3]):[0-5]\d$/, { message: TIME_MESSAGE })
  shiftStart?: string;

  @IsOptional()
  @Matches(/^$|^([01]\d|2[0-3]):[0-5]\d$/, { message: TIME_MESSAGE })
  shiftEnd?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PunchDto {
  @IsString()
  @MaxLength(64)
  code!: string;

  @Matches(PIN, { message: PIN_MESSAGE })
  pin!: string;
}

export class RecordsQueryDto {
  @Matches(DAY, { message: 'Fecha inválida.' })
  from!: string;

  @Matches(DAY, { message: 'Fecha inválida.' })
  to!: string;
}

export class UpdateRecordDto {
  @IsOptional()
  @IsISO8601({}, { message: 'Hora de entrada inválida.' })
  clockIn?: string;

  /** null para dejarla sin salida. */
  @IsOptional()
  @IsISO8601({}, { message: 'Hora de salida inválida.' })
  clockOut?: string | null;
}

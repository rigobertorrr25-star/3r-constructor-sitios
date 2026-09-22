import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../orders.constants.js';

/** Datos del negocio que el cliente llena al pedir su página. */
export class BriefDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  businessName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  businessType!: string;

  @IsString()
  @MinLength(10, { message: 'Cuéntanos un poco más sobre tu negocio (mínimo 10 caracteres)' })
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsBoolean()
  hasDomain?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  domainWanted?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  styleNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  references?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pagesWanted?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  extra?: string;
}

export class CreateOrderDto {
  @IsString()
  @Matches(/^[a-z0-9-]{1,100}$/)
  packageSlug!: string;

  /** Si contrata la mensualidad de hosting y mantenimiento. */
  @IsOptional()
  @IsBoolean()
  maintenance?: boolean;

  // ValidateNested por sí solo no exige que el campo exista: sin IsDefined llegaba `undefined` al servicio.
  @IsDefined({ message: 'Faltan los datos del negocio' })
  @IsObject()
  @ValidateNested()
  @Type(() => BriefDto)
  brief!: BriefDto;
}

export class MessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

// ───────── administración ─────────

export class UpdateOrderDto {
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: (typeof ORDER_STATUSES)[number];

  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  paymentStatus?: (typeof PAYMENT_STATUSES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500_000_000)
  amountPaidCents?: number;

  /** Enlace de la página entregada. Cadena vacía para quitarlo. */
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @Matches(/^https?:\/\/\S+$/i, { message: 'deliveryUrl debe empezar con http:// o https://' })
  @MaxLength(500)
  deliveryUrl?: string;
}

export class AdminEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;

  /** Nota interna: el cliente no la ve. */
  @IsOptional()
  @IsBoolean()
  internal?: boolean;
}

export class CreateOrderSiteDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{1,150}$/)
  templateSlug?: string;
}

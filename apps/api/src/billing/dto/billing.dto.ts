import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { SUBSCRIPTION_STATUSES } from '../billing.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SetPricesDto {
  /** { crm: 90000, tickets: null } — null quita el precio (queda por definir). */
  @IsObject() prices!: Record<string, number | null>;
}

export class SaveSubscriptionDto {
  @IsIn(SUBSCRIPTION_STATUSES) status!: string;
  @IsOptional() @Matches(/^(\d{4}-\d{2}-\d{2})?$/, { message: 'Escribe la fecha como AAAA-MM-DD' }) trialEndsAt?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(28) billingDay!: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) notes?: string;
}

export class MarkPaidDto {
  @IsIn(['transfer', 'wompi', 'other']) method!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) note?: string;
}

export class ConfirmInvoiceDto {
  @IsString() @MaxLength(100) transactionId!: string;
}

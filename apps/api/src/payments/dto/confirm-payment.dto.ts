import { IsString, Matches } from 'class-validator';

/** El id de transacción que Wompi agrega a la dirección de regreso (?id=…). */
export class ConfirmPaymentDto {
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,100}$/)
  transactionId!: string;
}

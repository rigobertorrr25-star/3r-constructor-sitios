import { Matches } from 'class-validator';

/** Nueva fecha de vencimiento del dominio propio (AAAA-MM-DD), por si el registrador dice otra. */
export class DomainExpiryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Escribe la fecha como AAAA-MM-DD' })
  expiresOn!: string;
}

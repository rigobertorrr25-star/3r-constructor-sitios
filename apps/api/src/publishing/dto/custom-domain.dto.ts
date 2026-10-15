import { IsString, MaxLength } from 'class-validator';

/** Dominio propio del cliente (tunegocio.com). Vacío lo quita. */
export class CustomDomainDto {
  @IsString()
  @MaxLength(255)
  domain!: string;
}

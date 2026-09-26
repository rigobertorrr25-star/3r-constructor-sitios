import { Equals, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  // Autorización de tratamiento de datos (Ley 1581): sin ella no se crea la cuenta.
  @Equals(true, { message: 'Debes aceptar la política de privacidad' })
  acceptPrivacy!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}

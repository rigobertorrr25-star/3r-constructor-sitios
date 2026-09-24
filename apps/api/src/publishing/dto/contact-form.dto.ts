import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ContactFormDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  // Honeypot: un campo que ningún visitante real llena (está oculto). Si viene con algo, es un bot.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;
}

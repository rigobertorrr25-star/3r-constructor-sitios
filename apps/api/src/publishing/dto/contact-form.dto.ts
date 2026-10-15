import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

  // Casilla de autorización de datos (Ley 1581). Opcional aquí: los sitios publicados antes de que existiera
  // no la mandan, y el navegador ya la exige en los nuevos.
  @IsOptional()
  @IsIn(['1'])
  consent?: string;

  // Honeypot: un campo que ningún visitante real llena (está oculto). Si viene con algo, es un bot.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;
}

import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

// Solo enlaces web: bloquea javascript:, data: y similares.
const URL_PATTERN = /^https?:\/\/[^\s]+$/i;
// Una captura puede ser https o una ruta propia del sitio (/portfolio/foto.png).
const IMAGE_PATTERN = /^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i;

export class CreatePortfolioItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsString()
  @Matches(URL_PATTERN, { message: 'url debe empezar con http:// o https://' })
  @MaxLength(500)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(IMAGE_PATTERN, { message: 'thumbnailUrl debe ser https o una ruta que empiece con /' })
  @MaxLength(500)
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePortfolioItemDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @Matches(URL_PATTERN, { message: 'url debe empezar con http:// o https://' })
  @MaxLength(500)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  /** Cadena vacía para quitar la captura. */
  @IsOptional()
  @Matches(/^$|^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i, { message: 'thumbnailUrl debe ser https o una ruta que empiece con /' })
  @MaxLength(500)
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateSiteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /** Slug de la plantilla de origen. Si falta se usa "blank" (en blanco). */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{1,150}$/)
  templateSlug?: string;
}

export class UpdateSiteDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

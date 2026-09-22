import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreatePageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Matches(SLUG, { message: 'slug solo admite minúsculas, números y guiones' })
  slug?: string;
}

export class UpdatePageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Matches(SLUG, { message: 'slug solo admite minúsculas, números y guiones' })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoDescription?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

/** Documento del editor. Su estructura se valida en el servicio (validateEditorDocument). */
export class AutosaveDto {
  @IsObject()
  content!: Record<string, unknown>;
}

export class CreateVersionDto {
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;
}

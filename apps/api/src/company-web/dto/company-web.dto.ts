import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf, ValidateNested } from 'class-validator';

export class FieldChangeDto {
  @IsString() @MaxLength(100) nodeId!: string;
  @IsOptional() @IsString() @MaxLength(5000) content?: string;
  @IsOptional() @IsString() @MaxLength(2000) href?: string;
  @IsOptional() @IsString() @MaxLength(2000) src?: string;
  @IsOptional() @IsString() @MaxLength(300) alt?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
}

export class SavePageContentDto {
  /** Versión sobre la que se editó: si alguien guardó otra mientras tanto, se avisa en vez de pisarla. */
  @IsUUID() baseVersionId!: string;
  @IsArray() @ArrayMaxSize(2000) @ValidateNested({ each: true }) @Type(() => FieldChangeDto) changes!: FieldChangeDto[];
}

export class WebImageDto {
  @IsIn(['image/png', 'image/jpeg', 'image/webp']) contentType!: string;
}

export class LinkSiteDto {
  @ValidateIf((_, v) => v !== null) @IsUUID() siteId!: string | null;
}

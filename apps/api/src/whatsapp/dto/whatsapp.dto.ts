import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ConnectWhatsappDto {
  @Transform(trim) @Matches(/^\d{5,40}$/, { message: 'El identificador del número son solo números' }) phoneNumberId!: string;
  @Transform(trim) @Matches(/^\d{5,40}$/, { message: 'El identificador de la cuenta son solo números' }) wabaId!: string;
  @Transform(trim) @IsString() @MinLength(7) @MaxLength(30) displayPhone!: string;
  /** Opcional al editar: si no viene, se deja el que había. */
  @IsOptional() @Transform(trim) @IsString() @MinLength(20, { message: 'Ese token es muy corto' }) @MaxLength(1000) accessToken?: string;
  @IsOptional() @IsIn(['active', 'paused']) status?: string;
}

export class SendTextDto {
  @Transform(trim) @IsString() @MinLength(1, { message: 'Escribe el mensaje' }) @MaxLength(4000) body!: string;
}

export class SendTemplateDto {
  @IsUUID() templateId!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(500, { each: true }) params?: string[];
}

export class StartConversationDto extends SendTemplateDto {
  @Transform(trim) @IsString() @MinLength(7, { message: 'Escribe el celular con indicativo' }) @MaxLength(25) phone!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) name?: string;
}

export class UpdateConversationDto {
  @IsOptional() @IsIn(['open', 'closed']) status?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() assignedMemberId?: string | null;
}

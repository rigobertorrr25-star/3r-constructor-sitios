import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ASSIGNABLE_ROLES, COMPANY_STATUSES, MEMBER_STATUSES } from '../companies.constants.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateCompanyDto {
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Escribe el nombre de la empresa' })
  @MaxLength(150)
  name!: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) taxId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) city?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) industry?: string;
}

export class UpdateCompanyDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(2) @MaxLength(150) name?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) taxId?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) city?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(60) industry?: string;
}

export class InviteMemberDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Escribe un correo válido' })
  @MaxLength(255)
  email!: string;

  @IsIn(ASSIGNABLE_ROLES)
  role!: string;
}

export class UpdateMemberDto {
  @IsOptional() @IsIn(ASSIGNABLE_ROLES) role?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) jobTitle?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(120) area?: string;
  /** AAAA-MM-DD, o vacío para quitarla. */
  @IsOptional() @Matches(/^(\d{4}-\d{2}-\d{2})?$/, { message: 'Escribe la fecha como AAAA-MM-DD' }) hiredAt?: string;
  @IsOptional() @IsIn(MEMBER_STATUSES) status?: string;
}

export class AcceptInviteDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;
}

export class AdminCompanyModulesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  keys!: string[];
}

export class AdminUpdateCompanyDto {
  @IsIn(COMPANY_STATUSES)
  status!: string;
}

import { Body, Controller, Get, HttpCode, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import type { AuthUser, RequestMeta } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from './dto/password.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtAuthGuard } from './jwt.guard.js';

interface RawRequest {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

const metaOf = (req: RawRequest): RequestMeta => {
  const ua = req.headers['user-agent'];
  return { ip: req.ip, userAgent: Array.isArray(ua) ? ua[0] : ua };
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  register(@Body() dto: RegisterDto, @Req() req: RawRequest) {
    return this.auth.register(dto, metaOf(req));
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() req: RawRequest) {
    return this.auth.login(dto, metaOf(req));
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto, @Req() req: RawRequest) {
    return this.auth.refresh(dto.refreshToken, metaOf(req));
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    // El token puede seguir siendo válido (no venció) aunque la cuenta ya no exista — por ejemplo,
    // si se borró directo en la base con la sesión todavía abierta en otro lado. 401, no 200 con
    // null: así el frontend manda a iniciar sesión de nuevo en vez de romperse con "null.firstName".
    const found = await this.users.findPublicById(user.id);
    if (!found) throw new UnauthorizedException();
    return found;
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: RawRequest) {
    await this.auth.requestPasswordReset(dto.email, metaOf(req));
    return { message: 'Si ese correo tiene una cuenta, te mandamos un enlace para cambiar tu contraseña.' };
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: RawRequest) {
    await this.auth.resetPassword(dto.token, dto.password, metaOf(req));
    return { message: 'Tu contraseña se cambió. Ya puedes iniciar sesión.' };
  }

  @Post('verify-email')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  resendVerification(@CurrentUser() user: AuthUser, @Req() req: RawRequest) {
    return this.auth.resendVerification(user.id, metaOf(req));
  }
}

import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service.js';
import { Role, UserStatus } from '../common/roles.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import type { AccessTokenPayload, RequestMeta } from './auth.types.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

type TokenPurpose = 'email_verification' | 'password_reset';

@Injectable()
export class AuthService {
  private readonly refreshTtlMs: number;
  private readonly verifyTokenTtlMs = 3 * 24 * 60 * 60 * 1000; // 3 días
  private readonly resetTokenTtlMs = 60 * 60 * 1000; // 1 hora
  private readonly resendCooldownMs = 60 * 1000; // 1 minuto
  // Hash de relleno para que login tarde parecido exista o no el email (evita enumerar usuarios).
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    config: ConfigService,
  ) {
    const days = Number(config.get('REFRESH_TOKEN_TTL_DAYS') ?? 30);
    this.refreshTtlMs = days * 24 * 60 * 60 * 1000;
  }

  async register(dto: RegisterDto, meta: RequestMeta) {
    const user = await this.users.create(dto);
    await this.audit.log({
      action: 'USER_REGISTERED',
      userId: user.id,
      entityType: 'user',
      entityId: user.id,
      ipAddress: meta.ip,
    });

    const verifyToken = await this.issueToken(user.id, 'email_verification', this.verifyTokenTtlMs);
    await this.email.sendWelcome(user.email, { firstName: user.firstName, verifyToken });
    await this.email.sendAdminNewSignup({ email: user.email, firstName: user.firstName });

    return user;
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.users.findByEmailWithHash(dto.email);
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const valid = await argon2.verify(hash, dto.password).catch(() => false);

    if (!user || !valid) throw new UnauthorizedException('Credenciales inválidas');
    if (user.status === UserStatus.DELETED) throw new UnauthorizedException('Credenciales inválidas');
    if (user.status === UserStatus.SUSPENDED) throw new ForbiddenException('Cuenta suspendida');

    const roles = user.roles.map((r) => r.role as Role);
    const tokens = await this.issueSession(user.id, roles, meta);
    await this.audit.log({
      action: 'USER_LOGIN',
      userId: user.id,
      entityType: 'user',
      entityId: user.id,
      ipAddress: meta.ip,
    });
    return { ...tokens, user: await this.users.findPublicById(user.id) };
  }

  /** Rota el refresh token: el anterior queda revocado. Reusar uno revocado revoca todas las sesiones. */
  async refresh(refreshToken: string, meta: RequestMeta) {
    const session = await this.prisma.userSession.findFirst({
      where: { refreshTokenHash: sha256(refreshToken) },
      include: { user: { include: { roles: true } } },
    });
    if (!session) throw new UnauthorizedException('Sesión inválida');

    if (session.revokedAt) {
      await this.prisma.userSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        userId: session.userId,
        entityType: 'user_session',
        entityId: session.id,
        ipAddress: meta.ip,
      });
      throw new UnauthorizedException('Sesión inválida');
    }
    if (session.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException('Sesión expirada');
    if (session.user.status !== UserStatus.ACTIVE) throw new UnauthorizedException('Sesión inválida');

    // Revoca solo si sigue activa: si dos peticiones llegan a la vez, solo una gana.
    const revoked = await this.prisma.userSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) throw new UnauthorizedException('Sesión inválida');

    const roles = session.user.roles.map((r) => r.role as Role);
    return this.issueSession(session.userId, roles, meta);
  }

  async logout(refreshToken: string) {
    await this.prisma.userSession.updateMany({
      where: { refreshTokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ───────── recuperar contraseña ─────────

  /** Responde igual exista o no la cuenta: no revela qué correos están registrados. */
  async requestPasswordReset(email: string, meta: RequestMeta) {
    const user = await this.users.findByEmailWithHash(email);
    if (!user || user.status !== UserStatus.ACTIVE) return;

    const resetToken = await this.issueToken(user.id, 'password_reset', this.resetTokenTtlMs);
    await this.email.sendPasswordReset(user.email, { firstName: user.firstName, resetToken });
    await this.audit.log({
      action: 'PASSWORD_RESET_REQUESTED',
      userId: user.id,
      entityType: 'user',
      entityId: user.id,
      ipAddress: meta.ip,
    });
  }

  async resetPassword(rawToken: string, newPassword: string, meta: RequestMeta) {
    const token = await this.consumeToken(rawToken, 'password_reset');
    if (!token) throw new BadRequestException('Ese enlace no es válido o ya expiró. Pide uno nuevo.');

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: token.userId }, data: { passwordHash } }),
      // Por seguridad, cambiar la contraseña cierra la sesión en todos los dispositivos.
      this.prisma.userSession.updateMany({ where: { userId: token.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log({
      action: 'PASSWORD_RESET',
      userId: token.userId,
      entityType: 'user',
      entityId: token.userId,
      ipAddress: meta.ip,
    });

    const user = await this.users.findPublicById(token.userId);
    if (user) await this.email.sendPasswordChanged(user.email, { firstName: user.firstName });
  }

  // ───────── verificar correo ─────────

  async verifyEmail(rawToken: string) {
    const token = await this.consumeToken(rawToken, 'email_verification');
    if (!token) throw new BadRequestException('Ese enlace no es válido o ya expiró. Pide uno nuevo desde tu cuenta.');

    await this.prisma.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: new Date() } });
    await this.audit.log({ action: 'EMAIL_VERIFIED', userId: token.userId, entityType: 'user', entityId: token.userId });
    return { verified: true };
  }

  async resendVerification(userId: string, meta: RequestMeta) {
    const user = await this.users.findPublicById(userId);
    if (!user) throw new UnauthorizedException();
    if (user.emailVerifiedAt) return { alreadyVerified: true };

    const recent = await this.prisma.verificationToken.findFirst({
      where: { userId, purpose: 'email_verification' },
      orderBy: { createdAt: 'desc' },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < this.resendCooldownMs) {
      throw new HttpException('Espera un momento antes de pedir otro enlace.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const verifyToken = await this.issueToken(userId, 'email_verification', this.verifyTokenTtlMs);
    await this.email.sendVerifyEmail(user.email, { firstName: user.firstName, verifyToken });
    await this.audit.log({ action: 'EMAIL_VERIFICATION_RESENT', userId, entityType: 'user', entityId: userId, ipAddress: meta.ip });
    return { sent: true };
  }

  // ───────── auxiliares ─────────

  private async issueToken(userId: string, purpose: TokenPurpose, ttlMs: number) {
    // Solo puede haber un enlace vigente por tipo: los anteriores quedan sin efecto.
    await this.prisma.verificationToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
    const raw = newToken();
    await this.prisma.verificationToken.create({
      data: { userId, purpose, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMs) },
    });
    return raw;
  }

  private async consumeToken(rawToken: string, purpose: TokenPurpose) {
    const token = await this.prisma.verificationToken.findFirst({
      where: { tokenHash: sha256(rawToken), purpose, usedAt: null },
    });
    if (!token || token.expiresAt.getTime() <= Date.now()) return null;

    // Solo se consume si seguía sin usar: evita una carrera si el enlace se abre dos veces a la vez.
    const consumed = await this.prisma.verificationToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return consumed.count === 1 ? token : null;
  }

  private getDummyHash() {
    this.dummyHash ??= argon2.hash('relleno-para-igualar-tiempos', { type: argon2.argon2id });
    return this.dummyHash;
  }

  private async issueSession(userId: string, roles: Role[], meta: RequestMeta) {
    const refreshToken = randomBytes(48).toString('base64url');
    const session = await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash: sha256(refreshToken),
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });
    const payload: AccessTokenPayload = { sub: userId, sid: session.id, roles };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, refreshToken };
  }
}

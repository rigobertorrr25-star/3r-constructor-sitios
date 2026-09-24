import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_SENDER, type MailSender } from './mail-sender.js';
import * as templates from './templates.js';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly webOrigin: string;
  private readonly adminEmail: string;

  constructor(
    @Inject(MAIL_SENDER) private readonly sender: MailSender,
    config: ConfigService,
  ) {
    this.webOrigin = (config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000').replace(/\/$/, '');
    this.adminEmail = config.get<string>('ADMIN_EMAIL') ?? '';
  }

  verifyUrl(token: string) {
    return `${this.webOrigin}/verificar?token=${encodeURIComponent(token)}`;
  }

  resetUrl(token: string) {
    return `${this.webOrigin}/restablecer?token=${encodeURIComponent(token)}`;
  }

  orderUrl(orderId: string) {
    return `${this.webOrigin}/dashboard/pedidos/${orderId}`;
  }

  adminOrderUrl(orderId: string) {
    return `${this.webOrigin}/admin/pedidos/${orderId}`;
  }

  /** Nunca deja que un correo caído rompa lo que lo disparó (registro, pedido…): solo lo registra. */
  private async safeSend(to: string, rendered: templates.RenderedEmail, replyTo?: string) {
    try {
      await this.sender.send({ to, ...rendered, replyTo });
    } catch (error) {
      this.logger.error(`No se pudo enviar "${rendered.subject}" a ${to}: ${(error as Error).message}`);
    }
  }

  // ───────── al cliente ─────────

  sendWelcome(to: string, data: { firstName?: string | null; verifyToken: string }) {
    return this.safeSend(to, templates.welcome({ firstName: data.firstName, verifyUrl: this.verifyUrl(data.verifyToken) }));
  }

  sendVerifyEmail(to: string, data: { firstName?: string | null; verifyToken: string }) {
    return this.safeSend(to, templates.verifyEmail({ firstName: data.firstName, verifyUrl: this.verifyUrl(data.verifyToken) }));
  }

  sendPasswordReset(to: string, data: { firstName?: string | null; resetToken: string }) {
    return this.safeSend(to, templates.passwordReset({ firstName: data.firstName, resetUrl: this.resetUrl(data.resetToken) }));
  }

  sendPasswordChanged(to: string, data: { firstName?: string | null }) {
    return this.safeSend(to, templates.passwordChanged(data));
  }

  sendOrderUpdate(to: string, data: { firstName?: string | null; orderId: string; orderCode: string; lines: string[] }) {
    return this.safeSend(to, templates.orderUpdate({ ...data, orderUrl: this.orderUrl(data.orderId) }));
  }

  sendOrderDelivered(to: string, data: { firstName?: string | null; orderId: string; orderCode: string; deliveryUrl: string }) {
    return this.safeSend(to, templates.orderDelivered({ ...data, orderUrl: this.orderUrl(data.orderId) }));
  }

  sendClientMessage(to: string, data: { firstName?: string | null; orderId: string; orderCode: string; body: string }) {
    return this.safeSend(to, templates.clientMessage({ ...data, orderUrl: this.orderUrl(data.orderId) }));
  }

  // ───────── al equipo ─────────

  sendAdminNewSignup(data: { email: string; firstName?: string | null }) {
    if (!this.adminEmail) return Promise.resolve();
    return this.safeSend(this.adminEmail, templates.adminNewSignup(data));
  }

  sendAdminNewOrder(data: {
    orderId: string;
    orderCode: string;
    businessName: string;
    packageName: string;
    clientEmail: string;
    priceCents: number;
    currency: string;
  }) {
    if (!this.adminEmail) return Promise.resolve();
    return this.safeSend(this.adminEmail, templates.adminNewOrder({ ...data, adminUrl: this.adminOrderUrl(data.orderId) }));
  }

  sendAdminNewMessage(data: { orderId: string; orderCode: string; businessName: string; body: string }) {
    if (!this.adminEmail) return Promise.resolve();
    return this.safeSend(this.adminEmail, templates.adminNewMessage({ ...data, adminUrl: this.adminOrderUrl(data.orderId) }));
  }

  // ───────── formulario de contacto de un sitio publicado ─────────

  /** `replyTo`: quien reciba esto puede simplemente responder el correo para llegarle al visitante. */
  sendSiteContactMessage(to: string, data: { siteName: string; name: string; email: string; phone?: string | null; message: string }) {
    return this.safeSend(to, templates.siteContactMessage(data), data.email);
  }
}

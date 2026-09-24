export const MAIL_SENDER = Symbol('MAIL_SENDER');

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Para que quien reciba el correo pueda responder directo a un visitante (formulario de contacto). */
  replyTo?: string;
}

export interface MailSender {
  send(message: MailMessage): Promise<void>;
}

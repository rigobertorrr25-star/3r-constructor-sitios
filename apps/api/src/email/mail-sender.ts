export const MAIL_SENDER = Symbol('MAIL_SENDER');

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Para que quien reciba el correo pueda responder directo a un visitante (formulario de contacto). */
  replyTo?: string;
  /** Nombre que ve quien recibe ("Café La Muralla"); la dirección sigue siendo la de 3R. */
  fromName?: string;
  /** Encabezados extra (por ejemplo List-Unsubscribe en las campañas). */
  headers?: Record<string, string>;
}

export interface MailSender {
  send(message: MailMessage): Promise<void>;
}

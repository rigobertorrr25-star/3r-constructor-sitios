import type { MailMessage, MailSender } from './mail-sender.js';

export interface SentEmail extends MailMessage {
  sentAt: string;
}

// Correos "enviados" en desarrollo, sin RESEND_API_KEY. Vive en memoria del proceso:
// sirve para que las pruebas de integración (que corren en el mismo proceso) los revisen.
export const sentEmails: SentEmail[] = [];
const MAX_KEEP = 200;

/** Sin llave de Resend, no se manda nada de verdad: se guarda aquí y se deja constancia en el log. */
export class LoggingMailSender implements MailSender {
  async send(message: MailMessage): Promise<void> {
    sentEmails.push({ ...message, sentAt: new Date().toISOString() });
    if (sentEmails.length > MAX_KEEP) sentEmails.shift();
    console.log(`[email] (modo prueba, sin RESEND_API_KEY) para ${message.to}: ${message.subject}`);
  }
}

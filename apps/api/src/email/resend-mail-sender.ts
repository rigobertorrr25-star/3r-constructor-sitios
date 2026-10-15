import type { MailMessage, MailSender } from './mail-sender.js';

/** Envía correos de verdad con la API de Resend (https://resend.com). */
export class ResendMailSender implements MailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  /** Solo la dirección de RESEND_FROM ("3R <hola@3rpaginas.com>" → "hola@3rpaginas.com"). */
  private get address() {
    return /<([^>]+)>/.exec(this.from)?.[1] ?? this.from;
  }

  async send(message: MailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: message.fromName ? `${message.fromName.replace(/[<>"\r\n]/g, '').slice(0, 60)} <${this.address}>` : this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        ...(message.headers ? { headers: message.headers } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Resend respondió ${res.status}: ${body.slice(0, 300)}`);
    }
  }
}

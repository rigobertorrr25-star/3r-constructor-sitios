export const WHATSAPP_CLIENT = Symbol('WHATSAPP_CLIENT');

export type WaAccount = { phoneNumberId: string; wabaId: string; token: string };
export type WaTemplate = { name: string; language: string; category: string; status: string; body: string };

/** Lo que la plataforma le pide a Meta (WhatsApp Cloud API). */
export interface WhatsappClient {
  sendText(account: WaAccount, to: string, body: string): Promise<string>;
  sendTemplate(account: WaAccount, to: string, name: string, language: string, params: string[]): Promise<string>;
  markRead(account: WaAccount, messageId: string): Promise<void>;
  templates(account: WaAccount): Promise<WaTemplate[]>;
}

const GRAPH = 'https://graph.facebook.com/v21.0';

export class MetaWhatsappClient implements WhatsappClient {
  private async call<T>(account: WaAccount, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${GRAPH}/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${account.token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok) throw new Error(data.error?.message ?? `Meta respondió ${res.status}`);
    return data;
  }

  async sendText(account: WaAccount, to: string, body: string) {
    const r = await this.call<{ messages: { id: string }[] }>(account, `${account.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body, preview_url: false },
    });
    return r.messages[0].id;
  }

  async sendTemplate(account: WaAccount, to: string, name: string, language: string, params: string[]) {
    const r = await this.call<{ messages: { id: string }[] }>(account, `${account.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name,
        language: { code: language },
        ...(params.length ? { components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }] } : {}),
      },
    });
    return r.messages[0].id;
  }

  async markRead(account: WaAccount, messageId: string) {
    await this.call(account, `${account.phoneNumberId}/messages`, { messaging_product: 'whatsapp', status: 'read', message_id: messageId });
  }

  async templates(account: WaAccount) {
    const r = await this.call<{
      data: { name: string; language: string; category: string; status: string; components?: { type: string; text?: string }[] }[];
    }>(account, `${account.wabaId}/message_templates?fields=name,language,category,status,components&limit=200`);
    return r.data.map((t) => ({
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      body: t.components?.find((c) => c.type === 'BODY')?.text ?? '',
    }));
  }
}

/** En desarrollo y pruebas: no habla con Meta. Guarda lo que se habría mandado. */
export class FakeWhatsappClient implements WhatsappClient {
  static readonly sent: { to: string; type: 'text' | 'template'; body: string; params?: string[] }[] = [];
  static templateList: WaTemplate[] = [
    {
      name: 'bienvenida',
      language: 'es',
      category: 'MARKETING',
      status: 'APPROVED',
      body: 'Hola {{1}}, gracias por escribirnos. ¿En qué te ayudamos?',
    },
    {
      name: 'pedido_listo',
      language: 'es',
      category: 'UTILITY',
      status: 'APPROVED',
      body: 'Hola {{1}}, tu pedido {{2}} ya está listo para recoger.',
    },
  ];
  static failNext = false;
  private n = 0;

  private push(entry: (typeof FakeWhatsappClient.sent)[number]) {
    if (FakeWhatsappClient.failNext) {
      FakeWhatsappClient.failNext = false;
      throw new Error('Meta no aceptó el mensaje (prueba)');
    }
    FakeWhatsappClient.sent.push(entry);
    if (FakeWhatsappClient.sent.length > 100) FakeWhatsappClient.sent.shift();
    return `wamid.fake.${Date.now()}.${++this.n}`;
  }

  async sendText(_a: WaAccount, to: string, body: string) {
    return this.push({ to, type: 'text', body });
  }

  async sendTemplate(_a: WaAccount, to: string, name: string, _language: string, params: string[]) {
    return this.push({ to, type: 'template', body: name, params });
  }

  async markRead() {}

  async templates() {
    return FakeWhatsappClient.templateList;
  }
}

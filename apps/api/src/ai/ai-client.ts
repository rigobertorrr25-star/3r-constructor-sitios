export const AI_CLIENT = Symbol('AI_CLIENT');

export type AiMessage = { role: 'user' | 'assistant'; content: string };
export type AiRequest = { system: string; messages: AiMessage[]; maxTokens?: number };
export type AiReply = { text: string; inputTokens: number; outputTokens: number };

/** Quien responde con IA. Null cuando no hay llave en producción: los módulos de IA lo dicen en pantalla. */
export interface AiClient {
  complete(request: AiRequest): Promise<AiReply>;
}

/** Claude, por la API de Anthropic (`ANTHROPIC_API_KEY`; modelo en `AI_MODEL`). */
export class AnthropicAiClient implements AiClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async complete({ system, messages, maxTokens = 1024 }: AiRequest): Promise<AiReply> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: this.model, max_tokens: maxTokens, system, messages }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`La IA respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
    return {
      text: data.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text ?? '')
        .join('')
        .trim(),
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    };
  }
}

/**
 * Sin llave, en desarrollo y en las pruebas: no llama a nadie. Para el asistente responde con la primera fuente que le
 * mandaron (o dice que no sabe); para los textos, tres opciones con el tema. `requests` deja ver qué se le habría mandado a la IA.
 */
export class FakeAiClient implements AiClient {
  static readonly requests: AiRequest[] = [];

  async complete(request: AiRequest): Promise<AiReply> {
    FakeAiClient.requests.push(request);
    if (FakeAiClient.requests.length > 50) FakeAiClient.requests.shift();
    const last = request.messages[request.messages.length - 1]?.content ?? '';
    const topic = /<tema>([\s\S]*?)<\/tema>/.exec(last);
    if (topic) {
      const t = topic[1].trim().slice(0, 80);
      const text = [1, 2, 3].map((n) => `Opción ${n}: ${t}`).join('\n---\n');
      return { text, inputTokens: Math.ceil(last.length / 4), outputTokens: Math.ceil(text.length / 4) };
    }
    // El asistente de WhatsApp: pasa a una persona si se lo piden; si no, contesta con lo primero que sabe del negocio.
    const business = /<negocio>\n([\s\S]*?)\n<\/negocio>/.exec(request.system);
    if (business) {
      const text = /persona|humano|asesor|queja/i.test(last)
        ? '[HUMANO] Ya le aviso a alguien del equipo para que te responda por aquí.'
        : `¡Hola! ${business[1].trim().split('\n')[0].slice(0, 160)}`;
      return { text, inputTokens: Math.ceil(request.system.length / 4), outputTokens: Math.ceil(text.length / 4) };
    }
    const source = /<fuente n="(\d+)"[^>]*>\n?([\s\S]*?)<\/fuente>/.exec(last);
    const text = source
      ? `Según los documentos: ${source[2].trim().slice(0, 200)} [${source[1]}]`
      : '[NO_SE] No encontré eso en los documentos de la empresa.';
    return { text, inputTokens: Math.ceil(last.length / 4), outputTokens: Math.ceil(text.length / 4) };
  }
}

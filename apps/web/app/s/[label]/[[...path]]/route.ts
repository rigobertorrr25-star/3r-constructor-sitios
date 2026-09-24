// Sirve las páginas publicadas. Se llega aquí por la dirección propia del cliente (etiqueta.tudominio.com,
// que proxy.ts reescribe a /s/etiqueta/…) o, como alternativa sin DNS, directamente en /s/etiqueta.
import type { NextRequest } from 'next/server';
import { API_URL } from '@/lib/api';

// Se reenvían tal cual las cabeceras que la API define para contenido publicado (CSP, sandbox, caché…).
const PASS = ['content-type', 'content-security-policy', 'x-content-type-options', 'referrer-policy', 'x-frame-options', 'cache-control'];

const unavailable = () =>
  new Response('<!doctype html><meta charset="utf-8"><title>No disponible</title><p style="font-family:system-ui;text-align:center;margin-top:20vh">Este sitio no está disponible en este momento.</p>', {
    status: 502,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });

export async function GET(_request: NextRequest, context: { params: Promise<{ label: string; path?: string[] }> }) {
  const { label, path = [] } = await context.params;
  const target = `${API_URL}/public/sites/${encodeURIComponent(label)}${path.map((part) => `/${encodeURIComponent(part)}`).join('')}`;

  let upstream: Response;
  try {
    upstream = await fetch(target, { cache: 'no-store' });
  } catch {
    return unavailable();
  }

  const headers = new Headers();
  for (const name of PASS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(await upstream.text(), { status: upstream.status, headers });
}

const gracias = (label: string, ok: boolean) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ok ? 'Mensaje enviado' : 'No se pudo enviar'}</title>
<body style="font-family:system-ui,sans-serif;text-align:center;margin-top:20vh;color:#111827">
<h1>${ok ? '¡Gracias! Tu mensaje fue enviado.' : 'No se pudo enviar tu mensaje.'}</h1>
<p><a href="/s/${encodeURIComponent(label)}">Volver al sitio</a></p>
</body>`,
    { status: ok ? 200 : 502, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  );

/** El formulario de contacto de un sitio publicado postea aquí (ver render.ts, caso 'form'). */
export async function POST(request: NextRequest, context: { params: Promise<{ label: string; path?: string[] }> }) {
  const { label, path = [] } = await context.params;
  if (path.join('/') !== 'contact') return unavailable();

  const form = await request.formData().catch(() => null);
  if (!form) return gracias(label, false);
  const body = {
    name: String(form.get('name') ?? ''),
    email: String(form.get('email') ?? ''),
    phone: form.get('phone') ? String(form.get('phone')) : undefined,
    message: String(form.get('message') ?? ''),
    website: form.get('website') ? String(form.get('website')) : undefined,
  };

  try {
    const upstream = await fetch(`${API_URL}/public/sites/${encodeURIComponent(label)}/contact`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    return gracias(label, upstream.ok);
  } catch {
    return gracias(label, false);
  }
}

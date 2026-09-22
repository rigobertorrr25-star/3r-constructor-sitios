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

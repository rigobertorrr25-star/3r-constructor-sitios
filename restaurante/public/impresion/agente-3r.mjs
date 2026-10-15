#!/usr/bin/env node
// Programa de impresión de Restaurant Control (3R).
// Queda prendido en un computador del restaurante: cada 2 segundos pregunta si hay comandas, precuentas o cierres de
// caja para imprimir y los manda a cada impresora térmica de red (puerto 9100). Necesita Node.js 18 o más nuevo.
//
// La primera vez pide la dirección del sistema y el código de la sede (se crea en Restaurant Control → Impresoras)
// y los guarda en config.json, al lado de este archivo. Para cambiar de código, borra config.json.

import { readFile, writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const VERSION = '1.0';
const EVERY_MS = 2000;
const CONFIG = join(dirname(fileURLToPath(import.meta.url)), 'config.json');

const now = () => new Date().toLocaleTimeString('es-CO');
const log = (msg) => console.log(`[${now()}] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadConfig() {
  try {
    const c = JSON.parse(await readFile(CONFIG, 'utf8'));
    if (c.servidor && c.codigo) return c;
  } catch {}
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('\nPrograma de impresión de Restaurant Control (3R) — configuración\n');
  const servidor = (await rl.question('Dirección del sistema (ej. https://3r-constructor-sitios-git1.vercel.app): ')).trim().replace(/\/+$/, '');
  const codigo = (await rl.question('Código de la sede (empieza por rc_): ')).trim();
  rl.close();
  const c = { servidor, codigo };
  await writeFile(CONFIG, JSON.stringify(c, null, 2));
  log('Configuración guardada en config.json');
  return c;
}

/** Manda los bytes a la impresora por la red y espera a que la conexión cierre bien. */
function send(host, port, data) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    let done = false;
    const finish = (err) => {
      if (done) return;
      done = true;
      socket.destroy();
      err ? reject(err) : resolve();
    };
    socket.setTimeout(8000, () => finish(new Error(`La impresora ${host} no respondió (¿está prendida y con papel?)`)));
    socket.on('error', (e) => finish(new Error(`No se pudo conectar con ${host}:${port} (${e.code || e.message})`)));
    socket.on('connect', () => socket.end(data));
    // Ya salieron todos los bytes: algunas impresoras no cierran la conexión, así que no se espera a que lo hagan.
    socket.on('finish', () => setTimeout(() => finish(), 300));
    socket.on('close', (hadError) => (hadError ? null : finish()));
  });
}

async function api(c, path, init = {}) {
  const res = await fetch(c.servidor + path, {
    ...init,
    headers: { Authorization: `Bearer ${c.codigo}`, 'Content-Type': 'application/json', 'User-Agent': `agente-3r/${VERSION}` },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 401) throw Object.assign(new Error('El código no es válido. Crea uno nuevo en Impresoras y borra config.json.'), { fatal: true });
  if (!res.ok) throw new Error(`El sistema respondió ${res.status}`);
  return res.json();
}

async function main() {
  const c = await loadConfig();
  log(`Programa de impresión ${VERSION} prendido. Conectado a ${c.servidor}. No cierres esta ventana.`);
  let offline = false;
  for (;;) {
    try {
      const { trabajos } = await api(c, '/api/impresion/trabajos');
      if (offline) (log('Conexión con el sistema recuperada.'), (offline = false));
      for (const t of trabajos) {
        try {
          await send(t.host, t.port, Buffer.from(t.data, 'base64'));
          log(`Impreso: ${t.title}`);
          await api(c, `/api/impresion/trabajos/${t.id}`, { method: 'POST', body: JSON.stringify({ ok: true }) });
        } catch (e) {
          if (e.fatal) throw e;
          log(`NO SALIÓ: ${t.title} — ${e.message}`);
          await api(c, `/api/impresion/trabajos/${t.id}`, { method: 'POST', body: JSON.stringify({ ok: false, error: e.message }) }).catch(() => {});
        }
      }
    } catch (e) {
      if (e.fatal) {
        log(e.message);
        await sleep(30000);
        continue;
      }
      if (!offline) log(`Sin conexión con el sistema (${e.message}). Sigo intentando…`);
      offline = true;
      await sleep(5000);
    }
    await sleep(EVERY_MS);
  }
}

main();

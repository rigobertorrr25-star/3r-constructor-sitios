#!/usr/bin/env node
// Programa de impresión de Restaurant Control (3R).
// Queda prendido en un computador del restaurante: cada 2 segundos pregunta si hay comandas, precuentas o cierres de
// caja para imprimir y los manda a cada impresora térmica: por la red (puerto 9100) o, en Windows, a la que está
// conectada por cable USB a este computador (por su nombre en Windows). Necesita Node.js 18 o más nuevo.
//
// La primera vez pide la dirección del sistema y el código de la sede (se crea en Restaurant Control → Impresoras)
// y los guarda en config.json, al lado de este archivo. Para cambiar de código, borra config.json.
// Al prender, si el sistema tiene una versión más nueva de este programa, se actualiza solo y vuelve a prender.

import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const VERSION = '1.2';
const SELF = fileURLToPath(import.meta.url);
const EVERY_MS = 2000;
const CONFIG = join(dirname(SELF), 'config.json');

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

// ───────── impresoras por cable USB (Windows) ─────────

const USB = 'usb:';
const isWindows = process.platform === 'win32' || process.env.RC_TEST_WINDOWS === '1';

function powershell(script, env = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { env: { ...process.env, ...env }, windowsHide: true, timeout: 30000 },
      (err, stdout, stderr) => (err ? reject(new Error((stderr || err.message).toString().trim())) : resolve(stdout.toString())),
    );
  });
}

// Manda los bytes tal cual (RAW) a una impresora instalada en Windows, como hacen los programas de caja. Arrancar
// PowerShell y armar esta parte tarda varios segundos en un computador de caja, así que se hace una sola vez: queda
// prendido y recibe cada papel por una línea («nombre<TAB>archivo») y contesta «FIN<TAB>error» (vacío si salió).
const RAW_PRINT = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class RawPrint3R {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool OpenPrinter(string name, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] static extern int StartDocPrinter(IntPtr h, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool WritePrinter(IntPtr h, byte[] b, int n, out int w);
  public static string Send(string name, byte[] bytes) {
    IntPtr h;
    if (!OpenPrinter(name, out h, IntPtr.Zero)) return "Windows no tiene una impresora llamada '" + name + "'";
    DOCINFO di = new DOCINFO(); di.pDocName = "Restaurant Control"; di.pDataType = "RAW";
    if (StartDocPrinter(h, 1, di) == 0) { ClosePrinter(h); return "Windows no dejo empezar a imprimir en '" + name + "'"; }
    StartPagePrinter(h);
    int w; bool ok = WritePrinter(h, bytes, bytes.Length, out w);
    EndPagePrinter(h); EndDocPrinter(h); ClosePrinter(h);
    return ok && w == bytes.Length ? "" : "La impresora '" + name + "' no recibio todo el papel";
  }
}
'@
[Console]::InputEncoding = [Text.Encoding]::UTF8
[Console]::OutputEncoding = [Text.Encoding]::UTF8
[Console]::Out.WriteLine('LISTO')
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  $parts = $line -split "\t", 2
  try { $e = [RawPrint3R]::Send($parts[0], [IO.File]::ReadAllBytes($parts[1])) } catch { $e = $_.Exception.Message }
  [Console]::Out.WriteLine("FIN\t" + ($e -replace '[\r\n\t]', ' '))
}
`;

let shell = null;
let queue = Promise.resolve();

/** El PowerShell que queda prendido para imprimir por USB; si se cae, se vuelve a prender en el siguiente papel. */
async function usbShell() {
  if (shell) return shell.ready;
  const script = join(tmpdir(), `rc-impresion-${process.pid}.ps1`);
  await writeFile(script, '\ufeff' + RAW_PRINT);
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const current = { child, waiting: null, buffer: '', ready: null };
  shell = current;
  const close = (why) => {
    if (shell === current) shell = null;
    if (current.waiting) current.waiting.reject(new Error(why));
    current.waiting = null;
  };
  current.ready = new Promise((resolve, reject) => {
    current.waiting = { resolve: () => resolve(current), reject };
  });
  let errors = '';
  child.stderr.on('data', (d) => (errors += d.toString()).length > 2000 && (errors = errors.slice(-2000)));
  child.stdout.on('data', (d) => {
    current.buffer += d.toString();
    let i;
    while ((i = current.buffer.indexOf('\n')) >= 0) {
      const line = current.buffer.slice(0, i).replace(/\r$/, '').replace(/^\ufeff/, '');
      current.buffer = current.buffer.slice(i + 1);
      const w = current.waiting;
      if (!w) continue;
      if (line === 'LISTO') (current.waiting = null), w.resolve();
      else if (line.startsWith('FIN\t')) {
        current.waiting = null;
        const error = line.slice(4).trim();
        error ? w.reject(new Error(error)) : w.resolve();
      }
    }
  });
  child.on('error', (e) => close(`No pude abrir PowerShell (${e.message}).`));
  child.on('exit', () => close(`PowerShell se cerró${errors.trim() ? `: ${errors.trim().split(/\r?\n/)[0]}` : ''}.`));
  return current.ready;
}

/** Un papel por cable USB: se pasan de a uno al PowerShell prendido. */
function sendUsb(name, data) {
  if (!isWindows) return Promise.reject(new Error('Las impresoras por cable USB solo funcionan con este programa en Windows.'));
  const job = queue.then(async () => {
    const file = join(tmpdir(), `rc-${randomUUID()}.bin`);
    await writeFile(file, data);
    try {
      const s = await usbShell();
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          s.child.kill();
          reject(new Error(`La impresora '${name}' no contestó en 30 segundos.`));
        }, 30000);
        s.waiting = {
          resolve: () => (clearTimeout(timer), resolve()),
          reject: (e) => (clearTimeout(timer), reject(e)),
        };
        s.child.stdin.write(`${name}\t${file}\n`);
      });
    } finally {
      await unlink(file).catch(() => {});
    }
  });
  queue = job.catch(() => {});
  return job;
}

/** Si el sistema tiene una versión más nueva de este programa, la descarga, se reemplaza y sale (el .bat lo vuelve a prender). */
async function updateSelf(c) {
  try {
    const res = await fetch(`${c.servidor}/impresion/agente-3r.mjs`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return;
    const latest = await res.text();
    const version = /const VERSION = '([^']+)'/.exec(latest)?.[1];
    if (!version || version === VERSION || !latest.includes('async function main()')) return;
    if ((await readFile(SELF, 'utf8')) === latest) return;
    await writeFile(SELF, latest);
    log(`Programa actualizado a la versión ${version}. Se vuelve a prender…`);
    process.exit(0);
  } catch {
    // Sin conexión o sin permiso para escribir: sigue con esta versión.
  }
}

/** Al prender, muestra las impresoras instaladas en Windows: ese nombre es el que va en Restaurant Control. */
async function listWindowsPrinters() {
  if (!isWindows) return;
  try {
    const out = await powershell('Get-WmiObject Win32_Printer | ForEach-Object { $_.Name }');
    const names = out.split(/\r?\n/).map((n) => n.trim()).filter(Boolean);
    console.log('\nImpresoras de este computador (para las de cable USB, copia el nombre exacto en Restaurant Control → Impresoras):');
    for (const n of names) console.log(`   • ${n}`);
    console.log('');
  } catch (e) {
    log(`No pude leer las impresoras de Windows (${e.message}).`);
  }
}

const print = (t, data) => (t.host.toLowerCase().startsWith(USB) ? sendUsb(t.host.slice(USB.length), data) : send(t.host, t.port, data));

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
  await updateSelf(c);
  log(`Programa de impresión ${VERSION} prendido. Conectado a ${c.servidor}. No cierres esta ventana.`);
  await listWindowsPrinters();
  // PowerShell se deja listo desde ya, para que el primer papel por USB también salga rápido.
  if (isWindows) usbShell().catch((e) => log(`No pude preparar la impresión por USB (${e.message}).`));
  let offline = false;
  for (;;) {
    try {
      const { trabajos } = await api(c, '/api/impresion/trabajos');
      if (offline) (log('Conexión con el sistema recuperada.'), (offline = false));
      for (const t of trabajos) {
        try {
          await print(t, Buffer.from(t.data, 'base64'));
          log(`Impreso: ${t.title}`);
          await api(c, `/api/impresion/trabajos/${t.id}`, { method: 'POST', body: JSON.stringify({ ok: true }) });
        } catch (e) {
          if (e.fatal) throw e;
          log(`NO SALIÓ: ${t.title} — ${e.message}`);
          await api(c, `/api/impresion/trabajos/${t.id}`, { method: 'POST', body: JSON.stringify({ ok: false, error: e.message }) }).catch(() => {});
        }
      }
      // Si había papeles, se vuelve a preguntar de una (puede haber más en cola).
      if (trabajos.length) continue;
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

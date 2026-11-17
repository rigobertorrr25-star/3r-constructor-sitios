// Arma la página «copiar y pegar» para cargar el catálogo a mano en la app de WhatsApp Business.
// Uso: node herramientas/pagina-whatsapp.mjs → catalogo/wpp-copiar.html (se publica como Artifact privado de Rigoberto).
// Las fotos van incrustadas (el Artifact no deja cargar imágenes de otros sitios) desde img/catalogo/<id>.jpg.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const BASE = '/home/user/3r-constructor-sitios/tiendas/llevalo/';
const URL = 'https://llevalo.rigoberto-rrr25.workers.dev';
const FUERA = new Set([2312645]); // suplementos: WhatsApp y Meta no los permiten
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + BASE + 'index.html');
const P = (await p.evaluate(() => PRODUCTS.map(q => ({ id: q.dropi, cat: q.cat, top: !!q.top, name: q.name, desc: q.desc, price: q.price, sizes: q.sizes || null, colors: q.colors || null }))))
  .filter(q => !FUERA.has(q.id));
const CATS = await p.evaluate(() => CATS.filter(c => c.id !== 'todo'));
// Miniaturas pequeñas para que la página pese poco.
for (const q of P) {
  const src = 'data:image/jpeg;base64,' + fs.readFileSync(BASE + 'img/catalogo/' + q.id + '.jpg').toString('base64');
  q.thumb = await p.evaluate(async (s) => { const im = new Image(); im.src = s; await im.decode();
    const c = document.createElement('canvas'); c.width = c.height = 360; c.getContext('2d').drawImage(im, 0, 0, 360, 360); return c.toDataURL('image/jpeg', 0.82); }, src);
}
await b.close();
const cop = (n) => '$' + n.toLocaleString('es-CO').replace(/,/g, '.');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const desc = (q) => {
  const l = [q.desc];
  if (q.sizes) l.push('Tamaños: ' + q.sizes.map(z => `${z.name} ${cop(z.price)}`).join(' · '));
  if (q.colors) l.push('Colores: ' + q.colors.join(', ').toLowerCase());
  l.push('✅ Pagas en efectivo cuando te llega\n✅ Envío gratis a toda Colombia\nEscríbenos para pedirlo.');
  return l.join('\n');
};
const field = (label, value, key, pre) => `<div class="f"><div class="fh"><span class="fl">${label}</span><button type="button" class="cp" data-copy="${esc(value)}">Copiar</button></div><div class="fv${pre ? ' pre' : ''}">${esc(value)}</div></div>`;
const sections = CATS.map(c => ({ ...c, items: P.filter(q => q.cat === c.id) })).filter(s => s.items.length);
const card = (q) => `<article class="it" id="p${q.id}">
  <div class="ph"><img src="${q.thumb}" alt="${esc(q.name)}" width="180" height="180"><a class="save" href="${URL}/img/catalogo/${q.id}.jpg" target="_blank" rel="noopener">Abrir foto para guardarla</a></div>
  <div class="data">
    <div class="top"><h3>${esc(q.name)}</h3>${q.top ? '<span class="mv">Más vendido</span>' : ''}</div>
    ${field('Nombre', q.name)}
    ${field('Precio', String(q.price))}
    ${field('Descripción', desc(q), null, true)}
    ${field('Enlace', URL)}
    ${field('Código del artículo', '3R-' + q.id)}
    <label class="done"><input type="checkbox" id="ok${q.id}" data-id="${q.id}"> Ya lo subí a WhatsApp</label>
  </div>
</article>`;
const html = `<title>Catálogo WhatsApp 3R Market</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Archivo+Black&display=swap" rel="stylesheet">
<style>
/* Marca 3R Market (tienda): grafito, verde neón de confianza, rojo-naranja de acción. Una sola apariencia clara a propósito. */
:root { --ink: #111827; --muted: #4b5563; --line: #d9dde3; --page: #eef0f2; --card: #ffffff; --neon: #39ff14; --green-text: #0f7400; --action: #d4320b; color-scheme: light;
  --display: "Archivo Black", "Arial Black", system-ui, sans-serif; --body: "Archivo", system-ui, -apple-system, "Segoe UI", sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink); font: 15px/1.45 var(--body); }
.wrap { max-width: 860px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
header { background: var(--ink); color: #fff; }
header .wrap { padding-block: 22px 20px; display: grid; gap: 10px; }
.logo { font: 28px/1 var(--display); letter-spacing: -.5px; } .logo span { font: 800 15px/1 var(--body); color: var(--neon); letter-spacing: 2px; margin-left: 6px; vertical-align: 4px; }
h1 { font: 22px/1.15 var(--display); margin: 4px 0 0; text-wrap: balance; }
header p { margin: 0; color: #d1d5db; max-width: 62ch; }
.prog { display: flex; align-items: center; gap: 10px; font-weight: 700; }
.bar { flex: 1; height: 8px; background: #374151; border-radius: 4px; overflow: hidden; } .bar i { display: block; height: 100%; width: 0; background: var(--neon); transition: width .3s; }
.how { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; margin: 16px 0 0; }
.how h2 { font: 16px/1.2 var(--display); margin: 0 0 6px; } .how ol { margin: 0; padding-left: 20px; } .how li { margin: 3px 0; }
nav { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--page); border-bottom: 1px solid var(--line); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--page); }
nav .wrap { display: flex; gap: 8px; overflow-x: auto; padding-block: 10px; scrollbar-width: none; }
nav a { flex: none; text-decoration: none; color: var(--ink); background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 7px 11px; font-weight: 700; font-size: 13px; }
nav a b { color: var(--green-text); margin-left: 4px; }
section { padding-block: 18px 4px; scroll-margin-top: 60px; }
section > h2 { font: 20px/1.2 var(--display); margin: 0 0 4px; } section > p { margin: 0 0 12px; color: var(--muted); }
.it { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 16px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
.it.is-done { border-color: var(--green-text); box-shadow: inset 4px 0 0 var(--neon); }
.ph { display: grid; gap: 8px; align-content: start; } .ph img { width: 100%; height: auto; aspect-ratio: 1; border-radius: 8px; border: 1px solid var(--line); background: #fff; max-width: 100%; }
.save { font-weight: 700; font-size: 13px; color: var(--green-text); }
.data { min-width: 0; display: grid; gap: 8px; }
.top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; } .top h3 { font: 17px/1.2 var(--display); margin: 0; }
.mv { background: var(--neon); color: #0b0b0b; font-weight: 800; font-size: 11.5px; padding: 3px 7px; border-radius: 4px; letter-spacing: .2px; }
.f { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.fh { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 5px 6px 5px 10px; background: var(--page); }
.fl { font-weight: 800; font-size: 12px; letter-spacing: .3px; text-transform: uppercase; color: var(--muted); }
.cp { border: 0; background: var(--action); color: #fff; font: 700 13px var(--body); padding: 7px 14px; border-radius: 6px; cursor: pointer; min-height: 34px; }
.cp.ok { background: var(--green-text); }
.cp:focus-visible, nav a:focus-visible, .done input:focus-visible { outline: 3px solid var(--neon); outline-offset: 2px; }
.fv { padding: 8px 10px; overflow-wrap: anywhere; user-select: all; } .fv.pre { white-space: pre-wrap; }
.done { display: flex; align-items: center; gap: 8px; font-weight: 700; cursor: pointer; } .done input { width: 20px; height: 20px; accent-color: var(--green-text); }
footer .wrap { padding-block: 20px 40px; color: var(--muted); font-size: 13px; }
@media (max-width: 560px) { .it { grid-template-columns: 1fr; } .ph { grid-template-columns: 120px 1fr; align-items: center; } }
@media (prefers-reduced-motion: reduce) { .bar i { transition: none; } }
</style>
<header><div class="wrap">
  <div class="logo">3R<span>MARKET</span></div>
  <h1>Catálogo para tu WhatsApp Business</h1>
  <p>${P.length} productos listos para copiar y pegar. Marca «Ya lo subí» en cada uno para no perderte; la marca se guarda en este celular.</p>
  <div class="prog"><div class="bar"><i id="barfill"></i></div><span id="count">0 de ${P.length}</span></div>
</div></header>
<main class="wrap">
  <div class="how"><h2>Cómo subir cada producto</h2><ol>
    <li>En WhatsApp Business: <b>Herramientas para la empresa → Catálogo → Agregar artículo nuevo</b>.</li>
    <li>Toca <b>«Abrir foto para guardarla»</b>, mantén presionada la foto y guárdala. Súbela en <b>Agregar imágenes</b>.</li>
    <li>Aquí toca <b>Copiar</b> y en WhatsApp pega: nombre, precio, descripción, enlace y código. Toca <b>Guardar</b>.</li>
    <li>Al final, en <b>Catálogo → Agregar nueva colección</b>, arma una colección por sección con estos mismos nombres. Los «Más vendido» ponlos también en una colección «Más vendidos».</li>
  </ol></div>
</main>
<nav aria-label="Secciones"><div class="wrap">${sections.map(s => `<a href="#${s.id}">${esc(s.name)}<b>${s.items.length}</b></a>`).join('')}</div></nav>
<main class="wrap">
${sections.map(s => `<section id="${s.id}"><h2>${esc(s.name)}</h2><p>Colección en WhatsApp: «${esc(s.name)}» · ${s.items.length} productos</p>${s.items.map(card).join('')}</section>`).join('')}
</main>
<footer><div class="wrap">Amua Vital Drops no está aquí porque WhatsApp no acepta suplementos; véndelo por la tienda. Tienda: ${URL.replace('https://', '')} · Actualizado el 17 de noviembre de 2026.</div></footer>
<script>
(function () {
  var KEY = '3r-wpp-subidos', done = {};
  try { done = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { done = {}; }
  var boxes = Array.prototype.slice.call(document.querySelectorAll('.done input'));
  function paint() {
    var n = 0;
    boxes.forEach(function (b) { var on = !!done[b.dataset.id]; b.checked = on; b.closest('.it').classList.toggle('is-done', on); if (on) n++; });
    document.getElementById('count').textContent = n + ' de ' + boxes.length;
    document.getElementById('barfill').style.width = (100 * n / boxes.length) + '%';
  }
  boxes.forEach(function (b) { b.addEventListener('change', function () { if (b.checked) done[b.dataset.id] = 1; else delete done[b.dataset.id];
    try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) {} paint(); }); });
  paint();
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.cp'); if (!btn) return;
    var text = btn.getAttribute('data-copy');
    function ok() { btn.textContent = 'Copiado'; btn.classList.add('ok'); setTimeout(function () { btn.textContent = 'Copiar'; btn.classList.remove('ok'); }, 1500); }
    function fallback() { var v = btn.closest('.f').querySelector('.fv'); var r = document.createRange(); r.selectNodeContents(v); var s = getSelection(); s.removeAllRanges(); s.addRange(r);
      btn.textContent = 'Mantén presionado y copia'; setTimeout(function () { btn.textContent = 'Copiar'; }, 2500); }
    try { navigator.clipboard.writeText(text).then(ok, fallback); } catch (err) { fallback(); }
  });
})();
</script>
`;
fs.writeFileSync(BASE + 'catalogo/wpp-copiar.html', html);
console.log('ok', P.length, (html.length / 1e6).toFixed(2) + ' MB');

// Arma la página «Publicar en Marketplace»: plan de 7 días, 5 publicaciones por día, una ciudad por día, todo para copiar.
// OJO: volver a armarla reparte los productos de nuevo entre los días. Si Rigoberto ya va publicando, mejor quitar
// tarjetas sueltas del HTML (así se quitó el Nafsi el 18 nov) y republicar el mismo archivo.
// Uso: node herramientas/pagina-marketplace.mjs → catalogo/marketplace.html (Artifact privado de Rigoberto; republicar el mismo archivo).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const BASE = '/home/user/3r-constructor-sitios/tiendas/llevalo/';
const URL = 'https://llevalo.rigoberto-rrr25.workers.dev';
const FUERA = new Set([2312645]); // suplementos: Facebook no los permite en Marketplace
const DIAS = [['Bogotá', 'Soacha'], ['Medellín', 'Bello'], ['Cali', 'Palmira'], ['Barranquilla', 'Soledad'], ['Bucaramanga', 'Floridablanca'], ['Cartagena', 'Turbaco'], ['Pereira', 'Dosquebradas']];
const CATMP = { perfumes: 'Salud y belleza', belleza: 'Salud y belleza', tecnologia: 'Electrónica', moto: 'Piezas y accesorios para vehículos', hogar: 'Hogar y cocina', herramientas: 'Herramientas', regalos: 'Juguetes y juegos', mascotas: 'Artículos para mascotas' };
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + BASE + 'index.html');
let P = (await p.evaluate(() => PRODUCTS.map(q => ({ id: q.dropi, cat: q.cat, top: !!q.top, vit: !!q.vitrina, name: q.name, desc: q.desc, price: q.price, sizes: q.sizes || null, colors: q.colors || null }))))
  .filter(q => !FUERA.has(q.id));
// Orden: más vendidos, luego perfumes, luego los destacados de la vitrina, luego el resto (cada producto una vez).
const rank = (q) => (q.top ? 0 : q.cat === 'perfumes' ? 1 : q.vit ? 2 : 3);
P.sort((a, c) => rank(a) - rank(c));
for (const q of P) {
  const src = 'data:image/jpeg;base64,' + fs.readFileSync(BASE + 'img/catalogo/' + q.id + '.jpg').toString('base64');
  q.thumb = await p.evaluate(async (s) => { const im = new Image(); im.src = s; await im.decode();
    const c = document.createElement('canvas'); c.width = c.height = 300; c.getContext('2d').drawImage(im, 0, 0, 300, 300); return c.toDataURL('image/jpeg', 0.8); }, src);
}
await b.close();
const cop = (n) => '$' + n.toLocaleString('es-CO').replace(/,/g, '.');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const short = (n) => n.replace(/ \((hombre|caja de lujo|luna)\)/, '').replace(/ Lattafa EDP/, ' Lattafa');
const field = (label, value, pre) => `<div class="f"><div class="fh"><span class="fl">${label}</span><button type="button" class="cp" data-copy="${esc(value)}">Copiar</button></div><div class="fv${pre ? ' pre' : ''}">${esc(value)}</div></div>`;
// Reparto en ronda: cada día mezcla más vendidos, perfumes y otras secciones.
const days = DIAS.map(([city, near], d) => ({ city, near, items: P.filter((_, i) => i % DIAS.length === d).slice(0, 5) })).filter(x => x.items.length);
const post = (q, city, key) => {
  const title = `${short(q.name)} · Envío a ${city} · Pago contra entrega`;
  const l = [q.desc];
  if (q.sizes) l.push(q.sizes.map(z => `📏 ${z.name}: ${cop(z.price)}`).join('\n'));
  if (q.colors) l.push('🎨 Colores: ' + q.colors.join(', ').toLowerCase());
  l.push(`✅ Pagas en efectivo cuando te llega\n✅ Envío gratis a ${city} y a toda Colombia\n✅ Te confirmamos por WhatsApp antes de enviarlo`);
  l.push(`Pídelo aquí 👉 ${URL}\nO escríbeme al WhatsApp 310 790 7194`);
  return `<article class="it" id="${key}">
  <div class="ph"><img src="${q.thumb}" alt="${esc(q.name)}" width="150" height="150"><a class="save" href="${URL}/img/catalogo/${q.id}.jpg" target="_blank" rel="noopener">Abrir foto para guardarla</a></div>
  <div class="data">
    <div class="top"><h3>${esc(q.name)}</h3>${q.top ? '<span class="mv">Más vendido</span>' : ''}</div>
    ${field('Título', title)}
    ${field('Precio', String(q.price))}
    <div class="meta"><span><b>Categoría:</b> ${CATMP[q.cat] || 'Varios'}</span><span><b>Estado:</b> Nuevo</span><span><b>Ubicación:</b> ${city}</span></div>
    ${field('Descripción', l.join('\n\n'), true)}
    <label class="done"><input type="checkbox" id="ok-${key}" data-id="${key}"> Ya lo publiqué</label>
  </div>
</article>`;
};
const total = days.reduce((n, d) => n + d.items.length, 0);
const html = `<title>Marketplace 3R Market</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Archivo+Black&display=swap" rel="stylesheet">
<style>
/* Marca 3R Market: grafito, verde neón de confianza, rojo-naranja de acción. Una sola apariencia clara a propósito. */
:root { --ink: #111827; --muted: #4b5563; --line: #d9dde3; --page: #eef0f2; --card: #ffffff; --neon: #39ff14; --green-text: #0f7400; --action: #d4320b; color-scheme: light;
  --display: "Archivo Black", "Arial Black", system-ui, sans-serif; --body: "Archivo", system-ui, -apple-system, "Segoe UI", sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink); font: 15px/1.45 var(--body); }
.wrap { max-width: 860px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
header { background: var(--ink); color: #fff; } header .wrap { padding-block: 22px 20px; display: grid; gap: 10px; }
.logo { font: 28px/1 var(--display); letter-spacing: -.5px; } .logo span { font: 800 15px/1 var(--body); color: var(--neon); letter-spacing: 2px; margin-left: 6px; vertical-align: 4px; }
h1 { font: 22px/1.15 var(--display); margin: 4px 0 0; text-wrap: balance; } header p { margin: 0; color: #d1d5db; max-width: 62ch; }
.prog { display: flex; align-items: center; gap: 10px; font-weight: 700; }
.bar { flex: 1; height: 8px; background: #374151; border-radius: 4px; overflow: hidden; } .bar i { display: block; height: 100%; width: 0; background: var(--neon); transition: width .3s; }
.how { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; margin: 16px 0 0; }
.how h2 { font: 16px/1.2 var(--display); margin: 0 0 6px; } .how ol { margin: 0; padding-left: 20px; } .how li { margin: 3px 0; }
.how .warn { margin: 10px 0 0; padding: 8px 10px; border-left: 4px solid var(--action); background: var(--page); }
nav { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--page); border-bottom: 1px solid var(--line); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--page); }
nav .wrap { display: flex; gap: 8px; overflow-x: auto; padding-block: 10px; scrollbar-width: none; }
nav a { flex: none; text-decoration: none; color: var(--ink); background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 7px 11px; font-weight: 700; font-size: 13px; }
nav a.full { background: var(--ink); color: #fff; border-color: var(--ink); }
section { padding-block: 18px 4px; scroll-margin-top: 60px; }
section > h2 { font: 20px/1.2 var(--display); margin: 0 0 4px; } section > p { margin: 0 0 12px; color: var(--muted); }
.it { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 16px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
.it.is-done { border-color: var(--green-text); box-shadow: inset 4px 0 0 var(--neon); }
.ph { display: grid; gap: 8px; align-content: start; } .ph img { width: 100%; height: auto; aspect-ratio: 1; border-radius: 8px; border: 1px solid var(--line); background: #fff; max-width: 100%; }
.save { font-weight: 700; font-size: 13px; color: var(--green-text); }
.data { min-width: 0; display: grid; gap: 8px; }
.top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; } .top h3 { font: 17px/1.2 var(--display); margin: 0; }
.mv { background: var(--neon); color: #0b0b0b; font-weight: 800; font-size: 11.5px; padding: 3px 7px; border-radius: 4px; }
.meta { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 14px; color: var(--muted); } .meta b { color: var(--ink); }
.f { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.fh { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 5px 6px 5px 10px; background: var(--page); }
.fl { font-weight: 800; font-size: 12px; letter-spacing: .3px; text-transform: uppercase; color: var(--muted); }
.cp { border: 0; background: var(--action); color: #fff; font: 700 13px var(--body); padding: 7px 14px; border-radius: 6px; cursor: pointer; min-height: 34px; }
.cp.ok { background: var(--green-text); }
.cp:focus-visible, nav a:focus-visible, .done input:focus-visible { outline: 3px solid var(--neon); outline-offset: 2px; }
.fv { padding: 8px 10px; overflow-wrap: anywhere; user-select: all; } .fv.pre { white-space: pre-wrap; }
.done { display: flex; align-items: center; gap: 8px; font-weight: 700; cursor: pointer; } .done input { width: 20px; height: 20px; accent-color: var(--green-text); }
footer .wrap { padding-block: 20px 40px; color: var(--muted); font-size: 13px; }
@media (max-width: 560px) { .it { grid-template-columns: 1fr; } .ph { grid-template-columns: 110px 1fr; align-items: center; } }
@media (prefers-reduced-motion: reduce) { .bar i { transition: none; } }
</style>
<header><div class="wrap">
  <div class="logo">3R<span>MARKET</span></div>
  <h1>Publicar en Marketplace</h1>
  <p>Plan de 7 días: 5 publicaciones por día, cada día en una ciudad. Copia, pega y marca «Ya lo publiqué». La marca se guarda en este celular.</p>
  <div class="prog"><div class="bar"><i id="barfill"></i></div><span id="count">0 de ${total}</span></div>
</div></header>
<main class="wrap">
  <div class="how"><h2>Cómo publicar cada producto</h2><ol>
    <li>Toca <b>«Abrir foto para guardarla»</b>, mantén presionada la foto y guárdala.</li>
    <li>En Facebook: <b>Marketplace → Vender → Artículo</b>. Sube la foto.</li>
    <li>Copia y pega el <b>título</b>, el <b>precio</b> y la <b>descripción</b>. Escoge la categoría y el estado <b>Nuevo</b>.</li>
    <li>En <b>Ubicación</b>, borra tu ciudad y escribe la del día. Toca <b>Siguiente</b> y <b>Publicar</b>.</li>
  </ol>
  <p class="warn"><b>Para que Facebook no te bloquee:</b> deja al menos 1 hora entre una publicación y otra, y no pases de 5 al día. Si Facebook rechaza una por el enlace, bórralo de la descripción y deja solo el WhatsApp.</p></div>
</main>
<nav aria-label="Días"><div class="wrap">${days.map((d, i) => `<a href="#dia${i + 1}" data-day="${i + 1}">Día ${i + 1} · ${esc(d.city)}</a>`).join('')}</div></nav>
<main class="wrap">
${days.map((d, i) => `<section id="dia${i + 1}"><h2>Día ${i + 1}${i === 0 ? ' (hoy)' : ''} · ${esc(d.city)}</h2><p>Ubicación: ${esc(d.city)}. Ese día comparte también las fotos en grupos de compra y venta de ${esc(d.city)} y ${esc(d.near)}.</p>${d.items.map((q, j) => post(q, d.city, `d${i + 1}-${q.id}`)).join('')}</section>`).join('')}
</main>
<footer><div class="wrap">Cuando termines los 7 días, repite la lista cambiando las ciudades (por ejemplo Manizales, Ibagué, Villavicencio, Santa Marta, Cúcuta, Neiva y Montería). Tienda: ${URL.replace('https://', '')}.</div></footer>
<script>
(function () {
  var KEY = '3r-mp-publicados', done = {};
  try { done = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { done = {}; }
  var boxes = Array.prototype.slice.call(document.querySelectorAll('.done input'));
  function paint() {
    var n = 0;
    boxes.forEach(function (b) { var on = !!done[b.dataset.id]; b.checked = on; b.closest('.it').classList.toggle('is-done', on); if (on) n++; });
    document.getElementById('count').textContent = n + ' de ' + boxes.length;
    document.getElementById('barfill').style.width = (100 * n / boxes.length) + '%';
    document.querySelectorAll('nav a').forEach(function (a) { var s = document.getElementById('dia' + a.dataset.day);
      var all = s.querySelectorAll('.done input'), c = s.querySelectorAll('.done input:checked'); a.classList.toggle('full', all.length && all.length === c.length); });
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
fs.writeFileSync(BASE + 'catalogo/marketplace.html', html);
console.log('ok', total, 'publicaciones,', (html.length / 1e6).toFixed(2) + ' MB');
console.log(days.map((d, i) => `Día ${i + 1} ${d.city}: ` + d.items.map(q => q.name).join(' | ')).join('\n'));

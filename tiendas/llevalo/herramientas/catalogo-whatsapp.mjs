import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const BASE = '/home/user/3r-constructor-sitios/tiendas/llevalo/';
const CAT = BASE + 'catalogo/';
const WA = CAT + 'whatsapp/';
const URL = 'https://llevalo.rigoberto-rrr25.workers.dev';
fs.rmSync(WA, { recursive: true, force: true }); fs.mkdirSync(WA, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + BASE + 'index.html');
const P = await p.evaluate(() => PRODUCTS.map(q => ({ id: q.dropi, cat: q.cat, top: !!q.top, name: q.name, desc: q.desc, price: q.price, sizes: q.sizes || null, colors: q.colors || null })));
const CATS = await p.evaluate(() => CATS.filter(c => c.id !== 'todo'));
const cop = (n) => '$' + n.toLocaleString('es-CO').replace(/,/g, '.');
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const F = CAT + 'fotos/';
const mime = (buf) => buf[0] === 0x89 ? 'image/png' : buf[0] === 0xff ? 'image/jpeg' : buf.slice(0, 3).toString() === 'GIF' ? 'image/gif' : 'image/webp';
const photo = (id) => {
  const f = id === 5417 ? BASE + 'img/5417.jpg' : id === 2238229 ? BASE + 'img/2238229.jpg' : F + id + '.src';
  const buf = fs.readFileSync(f); return 'data:' + mime(buf) + ';base64,' + buf.toString('base64');
};
const NOTE = {
  2312645: 'WhatsApp puede rechazar este artículo porque es un suplemento. Si lo rechaza, véndelo solo por la tienda.',
  2322158: 'Son carillas de quitar y poner, no implantes: no lo describas como tratamiento dental.',
};
const SECTIONS = [{ id: 'top', name: 'Más vendidos', items: P.filter(q => q.top) }, ...CATS.map(c => ({ id: c.id, name: c.name, items: P.filter(q => q.cat === c.id) }))].filter(s => s.items.length);

// Imagen limpia para el catálogo (foto centrada en fondo blanco, 1080x1080)
for (const s of SECTIONS) {
  const dir = WA + 'fotos-para-whatsapp/' + slug(s.name).replace(/-/g, '_') + '/';
  fs.mkdirSync(dir, { recursive: true });
  for (const q of s.items) {
    const data = await p.evaluate(async (src) => {
      const im = new Image(); im.src = src; await im.decode();
      const c = document.createElement('canvas'); c.width = c.height = 1080; const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, 1080, 1080);
      const k = Math.min(1000 / im.width, 1000 / im.height), w = im.width * k, h = im.height * k;
      x.drawImage(im, (1080 - w) / 2, (1080 - h) / 2, w, h); return c.toDataURL('image/jpeg', 0.9);
    }, photo(q.id));
    q.clean = dir + `3R-${q.id}-${slug(q.name)}.jpg`;
    fs.writeFileSync(q.clean, Buffer.from(data.split(',')[1], 'base64'));
  }
}

const waDesc = (q) => {
  const l = [q.desc];
  if (q.sizes) l.push('Tamaños: ' + q.sizes.map(z => `${z.name} ${cop(z.price)}`).join(' · '));
  if (q.colors) l.push('Colores: ' + q.colors.join(', ').toLowerCase());
  l.push('✅ Pagas en efectivo cuando te llega\n✅ Envío gratis a toda Colombia\nEscríbenos para pedirlo.');
  return l.join('\n');
};
let n = 0;
const item = (q) => {
  n++;
  const img = 'data:image/jpeg;base64,' + fs.readFileSync(q.clean).toString('base64');
  return `<div class="it">
  <img src="${img}" alt="">
  <div class="f">
    <div class="t"><span class="num">${n}</span><b>${esc(q.name)}</b></div>
    <div class="row"><span class="k">Precio</span><span class="v pr">${q.price}</span><span class="k">Código</span><span class="v">3R-${q.id}</span></div>
    <div class="k">Descripción</div><div class="v pre">${esc(waDesc(q))}</div>
    <div class="row"><span class="k">Enlace</span><span class="v">${URL.replace('https://', '')}</span></div>
    ${NOTE[q.id] ? `<div class="warn">Ojo: ${esc(NOTE[q.id])}</div>` : ''}
  </div></div>`;
};
const idx = SECTIONS.map(s => `<tr><td>${esc(s.name)}</td><td>${s.items.length}</td></tr>`).join('');
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Archivo+Black&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 12mm 12mm; }
* { box-sizing: border-box; }
body { font-family: Archivo, sans-serif; color: #111827; margin: 0; font-size: 10pt; line-height: 1.4; background: #fff; }
h1, h2, h3 { font-family: "Archivo Black", sans-serif; margin: 0; line-height: 1.1; }
.cover { background: #111827; color: #fff; margin: -12mm; padding: 28mm 14mm 14mm; height: 297mm; display: flex; flex-direction: column; page-break-after: always; }
.logo { font-family: "Archivo Black"; font-size: 54pt; }
.logo span { font-family: Archivo; font-weight: 800; color: #39ff14; font-size: 28pt; letter-spacing: 2px; margin-left: 10px; }
.cover h1 { font-size: 30pt; margin-top: 16mm; }
.cover p { font-size: 13pt; color: #d1d5db; max-width: 160mm; }
.cover table { margin-top: 8mm; color: #fff; border-collapse: collapse; width: 100mm; font-size: 12pt; }
.cover td { border-bottom: 1px solid #374151; padding: 2mm 0; }
.cover td:last-child { text-align: right; color: #39ff14; font-weight: 800; }
.band { margin-top: auto; background: #39ff14; color: #0b0b0b; padding: 6mm 8mm; font-weight: 800; font-size: 13pt; border-radius: 4px; }
.band small { display: block; font-weight: 600; font-size: 10.5pt; margin-top: 1.5mm; }
.guide { page-break-after: always; }
.guide h2, .sec h2 { font-size: 19pt; padding-bottom: 2mm; border-bottom: 3px solid #39ff14; margin-bottom: 4mm; }
.guide h3 { font-size: 12pt; margin: 5mm 0 1.5mm; }
.guide ol, .guide ul { margin: 0; padding-left: 6mm; } .guide li { margin: 1.2mm 0; }
.tip { background: #f3f4f6; border-left: 4px solid #e8380d; padding: 3mm 4mm; margin: 3mm 0; }
.ok { background: #eaffe4; border-left: 4px solid #138a00; padding: 3mm 4mm; margin: 3mm 0; }
.sec { page-break-before: always; }
.sec .sub { color: #4b5563; margin: -2mm 0 3mm; }
.it { display: grid; grid-template-columns: 42mm 1fr; gap: 5mm; padding: 3.5mm 0; border-bottom: 1px solid #e5e7eb; page-break-inside: avoid; }
.it img { width: 42mm; height: 42mm; border: 1px solid #e5e7eb; border-radius: 3px; }
.t { display: flex; align-items: center; gap: 2.5mm; font-size: 12pt; margin-bottom: 1.5mm; }
.num { background: #111827; color: #39ff14; font-family: "Archivo Black"; min-width: 7mm; height: 7mm; display: grid; place-items: center; border-radius: 3px; font-size: 9pt; }
.row { display: flex; align-items: center; gap: 2mm; margin: 1mm 0; flex-wrap: wrap; }
.k { font-weight: 800; font-size: 8pt; text-transform: uppercase; letter-spacing: .4px; color: #138a00; }
.v { border: 1px solid #d1d5db; border-radius: 3px; padding: 1mm 2.5mm; font-size: 9.4pt; }
.v.pr { font-weight: 800; color: #e8380d; }
.v.pre { white-space: pre-wrap; margin: 1mm 0; }
.warn { color: #b42318; font-weight: 600; font-size: 9pt; margin-top: 1mm; }
</style></head><body>
<div class="cover">
  <div class="logo">3R<span>MARKET</span></div>
  <h1>Catálogo para WhatsApp Business</h1>
  <p>${P.length} productos separados por secciones, con todo lo que pide WhatsApp para cada artículo: foto, nombre, precio, descripción, enlace y código. Las fotos están en la carpeta «fotos-para-whatsapp», una carpeta por sección.</p>
  <table>${idx}</table>
  <div class="band">WhatsApp 310 790 7194 · Pagas cuando te llega · Envío gratis<small>Tienda: ${URL.replace('https://', '')} · Actualizado el 17 de noviembre de 2026</small></div>
</div>
<div class="guide">
  <h2>Cómo montar tu tienda en WhatsApp</h2>
  <h3>1. Ten WhatsApp Business</h3>
  <ol>
    <li>Descarga <b>WhatsApp Business</b> (ícono con una «B») desde Play Store o App Store.</li>
    <li>Al abrirla, usa tu número <b>310 790 7194</b>. Te ofrece pasar tus chats de WhatsApp normal: dile que sí y no pierdes nada.</li>
    <li>Pon como nombre <b>3R Market</b>, categoría <b>Compras y ventas</b>, y en la descripción: «Pagas cuando te llega. Envío gratis a toda Colombia.»</li>
  </ol>
  <h3>2. Sube cada producto al catálogo</h3>
  <ol>
    <li>Toca <b>⋮ (o Configuración) → Herramientas para la empresa → Catálogo → Agregar artículo nuevo</b>.</li>
    <li><b>Imagen:</b> sube la foto del producto desde la carpeta de su sección (el nombre del archivo empieza con su código).</li>
    <li>Copia de este PDF: <b>Nombre</b>, <b>Precio</b> (solo el número), <b>Descripción</b>, <b>Enlace</b> y <b>Código del artículo</b>.</li>
    <li>Toca <b>Guardar</b>. WhatsApp revisa cada artículo; puede tardar un rato en aparecer.</li>
  </ol>
  <div class="tip"><b>Truco para ir rápido:</b> pasa el PDF y las fotos al celular. Ve sección por sección. Empieza por <b>Más vendidos</b> y <b>Perfumes</b>, que son las que más te pueden dejar.</div>
  <h3>3. Arma las secciones (colecciones)</h3>
  <ol>
    <li>En <b>Catálogo</b>, toca <b>Agregar nueva colección</b>.</li>
    <li>Ponle el nombre de la sección, por ejemplo <b>Perfumes</b>, y marca los productos de esa sección.</li>
    <li>Repite con cada sección de este PDF. Un producto puede estar en dos colecciones (por ejemplo en «Más vendidos» y en «Belleza»).</li>
  </ol>
  <h3>4. Comparte tu catálogo</h3>
  <ul>
    <li>Tu enlace de catálogo es <b>wa.me/c/573107907194</b>. Ponlo en tus estados, en Instagram, TikTok y en Marketplace.</li>
    <li>En un chat, toca el clip 📎 → <b>Catálogo</b> para mandarle a un cliente un producto o una colección completa.</li>
    <li>Crea <b>respuestas rápidas</b> (Herramientas para la empresa → Respuestas rápidas) con los mensajes para pedir los datos y confirmar el pedido.</li>
  </ul>
  <div class="ok"><b>Cuando alguien pida:</b> pídele nombre, celular, ciudad, dirección y barrio. Confírmale producto, total y «pago contra entrega». Solo cuando te responda «sí», crea el pedido en Dropi con el código del producto (el número después de «3R-» es la referencia de Dropi).</div>
  <div class="tip"><b>Perfumes:</b> son Lattafa de los que en Dropi tienen código de barras y precio de original. Antes del primer pedido, pregúntale al proveedor por Dropi si son originales; las réplicas no las pongas, porque WhatsApp y Facebook las rechazan y te pueden bloquear.</div>
</div>
${SECTIONS.map(s => `<div class="sec"><h2>${esc(s.name)}</h2><p class="sub">${s.items.length} productos · nombre de la colección en WhatsApp: «${esc(s.name)}»</p>${s.items.map(item).join('')}</div>`).join('')}
</body></html>`;
fs.writeFileSync(WA + 'catalogo-whatsapp.html', html);
await p.goto('file://' + WA + 'catalogo-whatsapp.html', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.pdf({ path: CAT + '3R-Market-catalogo-WhatsApp.pdf', format: 'A4', printBackground: true });
console.log('ok', P.length, SECTIONS.map(s => s.name + ':' + s.items.length).join(', '));
await b.close();

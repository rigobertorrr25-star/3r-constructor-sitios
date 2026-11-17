import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const BASE = '/home/user/3r-constructor-sitios/tiendas/llevalo/';
const OUT = BASE + 'catalogo/';
const URL = 'https://llevalo.rigoberto-rrr25.workers.dev';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + BASE + 'index.html');
const P = await p.evaluate(() => PRODUCTS.map(q => ({ id: q.dropi, cat: q.cat, top: !!q.top, name: q.name, desc: q.desc, price: q.price, sizes: q.sizes || null, colors: q.colors || null })));
const CATN = Object.fromEntries(await p.evaluate(() => CATS.map(c => [c.id, c.name])));
const cop = (n) => '$' + n.toLocaleString('es-CO').replace(/,/g, '.');
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const EXTRA = {
  2312645: 'No escribas que cura, adelgaza ni que es medicina: solo lo que diga la caja.',
  2322158: 'Son carillas de quitar y poner, no implantes: no lo publiques como tratamiento dental.',
  375183: 'Es grande y de vidrio: confirma bien la dirección antes de despachar.',
};
const texts = P.map((q) => {
  const lines = [q.desc];
  if (q.sizes) lines.push(q.sizes.map(z => `📏 ${z.name}: ${cop(z.price)}`).join('\n'));
  if (q.colors) lines.push('🎨 Colores: ' + q.colors.join(', ').toLowerCase());
  lines.push('✅ Pagas en efectivo cuando te llega\n✅ Envío gratis a toda Colombia\n✅ Te confirmamos por WhatsApp antes de enviarlo');
  lines.push(`Pídelo aquí 👉 ${URL}\nO escríbeme al WhatsApp 310 790 7194`);
  return {
    ...q,
    title: `${q.name} · Pago contra entrega`,
    priceTxt: (q.sizes ? 'Desde ' : '') + cop(q.price),
    mpPrice: q.price,
    body: lines.join('\n\n'),
    estado: `${q.top ? '🔥 ' : ''}${q.name}, ${(q.sizes ? 'desde ' : '') + cop(q.price)}. Envío gratis y pagas cuando te llega 📦 ${URL}`,
    img: 'imagenes/cuadradas/' + slug(q.name) + '.jpg',
    note: EXTRA[q.id] || '',
  };
});

const CIUDADES = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga', 'Pereira', 'Manizales', 'Ibagué', 'Villavicencio', 'Santa Marta', 'Cúcuta', 'Pasto', 'Neiva', 'Montería', 'Armenia'];
const SEMANA = [
  ['Lunes', 'Bogotá', 'Soacha'], ['Martes', 'Medellín', 'Bello'], ['Miércoles', 'Cali', 'Palmira'],
  ['Jueves', 'Barranquilla', 'Cartagena'], ['Viernes', 'Bucaramanga', 'Cúcuta'], ['Sábado', 'Pereira', 'Manizales'], ['Domingo', 'Ibagué', 'Villavicencio'],
];

const card = (t, i) => `
<section class="prod">
  <img src="${t.img}" alt="">
  <div class="info">
    <div class="head"><span class="n">${i + 1}</span><h3>${esc(t.name)}</h3>${t.top ? '<span class="tag">Más vendido</span>' : ''}</div>
    <p class="meta"><b>${t.priceTxt}</b> · ${esc(CATN[t.cat] || '')} · Ref. Dropi ${t.id}</p>
    <div class="lbl">Título para Marketplace</div>
    <div class="box">${esc(t.title)}</div>
    <div class="lbl">Precio para Marketplace</div>
    <div class="box">${t.mpPrice}</div>
    <div class="lbl">Descripción</div>
    <div class="box pre">${esc(t.body)}</div>
    <div class="lbl">Estado de WhatsApp</div>
    <div class="box">${esc(t.estado)}</div>
    ${t.note ? `<p class="warn">Ojo: ${esc(t.note)}</p>` : ''}
  </div>
</section>`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Archivo+Black&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 14mm 13mm; }
* { box-sizing: border-box; }
body { font-family: Archivo, sans-serif; color: #111827; margin: 0; font-size: 10.5pt; line-height: 1.42; background: #fff; }
h1, h2, h3 { font-family: "Archivo Black", sans-serif; margin: 0; line-height: 1.1; }
.cover { background: #111827; color: #fff; padding: 30mm 14mm 16mm; margin: -14mm -13mm 0; height: 297mm; page-break-after: always; display: flex; flex-direction: column; }
.logo { font-family: "Archivo Black"; font-size: 54pt; letter-spacing: -1px; }
.logo span { font-family: Archivo; font-weight: 800; color: #39ff14; font-size: 28pt; letter-spacing: 2px; margin-left: 10px; }
.cover h1 { font-size: 30pt; margin-top: 18mm; max-width: 150mm; }
.cover p { font-size: 13pt; color: #d1d5db; max-width: 150mm; }
.cover .band { margin-top: auto; background: #39ff14; color: #0b0b0b; padding: 7mm 8mm; font-weight: 800; font-size: 14pt; border-radius: 4px; }
.cover .band small { display: block; font-weight: 600; font-size: 11pt; margin-top: 2mm; }
.idx { margin-top: 10mm; font-size: 12pt; color: #fff; }
.idx li { margin: 2mm 0; }
.guide { page-break-after: always; }
.guide h2 { font-size: 20pt; margin: 0 0 4mm; padding-bottom: 2mm; border-bottom: 3px solid #39ff14; }
.guide h3 { font-size: 12.5pt; margin: 6mm 0 2mm; }
.guide ol, .guide ul { margin: 0; padding-left: 6mm; }
.guide li { margin: 1.3mm 0; }
.tip { background: #f3f4f6; border-left: 4px solid #e8380d; padding: 3mm 4mm; margin: 4mm 0; }
.ok { background: #eaffe4; border-left: 4px solid #138a00; padding: 3mm 4mm; margin: 4mm 0; }
table { border-collapse: collapse; width: 100%; margin-top: 2mm; }
td, th { border: 1px solid #d1d5db; padding: 2mm 3mm; text-align: left; font-size: 10pt; }
th { background: #111827; color: #fff; }
.msg { border: 1px solid #d1d5db; padding: 3mm 4mm; white-space: pre-wrap; margin: 2mm 0 4mm; background: #fafafa; }
.prods h2 { font-size: 20pt; margin-bottom: 4mm; padding-bottom: 2mm; border-bottom: 3px solid #39ff14; }
.prod { display: grid; grid-template-columns: 62mm 1fr; gap: 6mm; padding: 5mm 0; border-bottom: 1px solid #e5e7eb; page-break-inside: avoid; }
.prod img { width: 62mm; height: 62mm; border-radius: 4px; display: block; }
.head { display: flex; align-items: center; gap: 3mm; }
.head .n { background: #111827; color: #39ff14; font-family: "Archivo Black"; min-width: 8mm; height: 8mm; display: grid; place-items: center; border-radius: 3px; font-size: 10pt; }
.head h3 { font-size: 13.5pt; }
.tag { background: #39ff14; color: #0b0b0b; font-weight: 800; font-size: 8pt; padding: 1mm 2mm; border-radius: 3px; white-space: nowrap; }
.meta { margin: 1.5mm 0 2mm; color: #4b5563; }
.meta b { color: #e8380d; font-size: 12pt; }
.lbl { font-weight: 800; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .4px; color: #138a00; margin-top: 2mm; }
.box { border: 1px solid #d1d5db; border-radius: 3px; padding: 1.8mm 3mm; margin-top: 1mm; font-size: 9.6pt; }
.box.pre { white-space: pre-wrap; }
.warn { margin: 2mm 0 0; font-size: 9.3pt; color: #b42318; font-weight: 600; }
</style></head><body>

<div class="cover">
  <div class="logo">3R<span>MARKET</span></div>
  <h1>Catálogo para publicar</h1>
  <p>Tus ${texts.length} productos con la imagen lista, el título, el precio y el texto para copiar y pegar en Marketplace, grupos y WhatsApp. Al inicio, la guía para vender en otras ciudades.</p>
  <ol class="idx">
    <li>Cómo publicar en otras ciudades (página 2)</li>
    <li>Plan de la semana por ciudades y mensajes (página 3)</li>
    <li>Los ${texts.length} productos con imagen y textos (página 4 en adelante)</li>
  </ol>
  <div class="band">Tienda: ${URL.replace('https://', '')}<small>WhatsApp 310 790 7194 · Pagas cuando te llega · Envío gratis · Actualizado el 17 de noviembre de 2026</small></div>
</div>

<div class="guide">
  <h2>Cómo publicar en otras ciudades</h2>
  <p>Tus productos los despacha Dropi a toda Colombia, así que puedes vender en cualquier ciudad aunque tú no estés allá. Lo que cambia es dónde te ven: Marketplace muestra cada publicación a la gente que está cerca de la ubicación que le pongas.</p>

  <h3>1. Facebook Marketplace (lo más importante)</h3>
  <ol>
    <li>Abre Facebook → <b>Marketplace</b> → <b>Vender</b> → <b>Artículo</b>.</li>
    <li>Sube la <b>imagen cuadrada</b> del producto (carpeta «cuadradas»). Si tienes más fotos del producto, agrégalas también.</li>
    <li>Copia de este catálogo el <b>título</b>, el <b>precio</b> (solo el número) y la <b>descripción</b>.</li>
    <li>Categoría: la más parecida (Hogar, Herramientas, Salud y belleza, Accesorios para vehículos, Juguetes, Mascotas). Estado: <b>Nuevo</b>.</li>
    <li>Toca <b>Ubicación</b>, borra tu ciudad y escribe la ciudad nueva, por ejemplo <b>Medellín</b>. Escoge la que sale en la lista.</li>
    <li>Toca <b>Siguiente</b> y <b>Publicar</b>. Listo: esa publicación la ve la gente de Medellín.</li>
    <li>Para otra ciudad, repite: misma imagen y texto, pero cambia la ubicación (y si puedes, el título, mira el truco abajo).</li>
  </ol>
  <div class="tip"><b>Para que Facebook no te bloquee:</b> máximo <b>3 a 5 publicaciones por día</b>, separadas por lo menos 1 hora. No publiques el mismo producto en la misma ciudad dos veces. Cambia un poco el título en cada ciudad, por ejemplo: «Luces LED para espejo · Envío a Medellín · Pagas al recibir». Si Facebook te pide verificar algo o te frena, para ese día y sigue al otro.</div>
  <div class="ok"><b>Sé claro:</b> en cada descripción ya dice «Envío gratis a toda Colombia». Así nadie cree que estás en su ciudad para recoger en persona. Si te preguntan, la respuesta es: «Te llega a tu casa por transportadora y pagas al recibir».</div>

  <h3>2. Grupos de Facebook de cada ciudad</h3>
  <ol>
    <li>En el buscador de Facebook escribe <b>«compra venta Medellín»</b>, <b>«ventas Cali»</b>, <b>«emprendedores Barranquilla»</b>, <b>«mamás Bogotá»</b> y toca <b>Grupos</b>.</li>
    <li>Únete a 5 a 10 grupos por ciudad (los que tengan miles de miembros y publicaciones recientes). Algunos tardan en aceptarte.</li>
    <li>Lee las reglas: muchos solo dejan vender ciertos días.</li>
    <li>Publica la imagen con el texto del producto y agrega al inicio: <b>«Envío a [ciudad], pagas cuando te llega»</b>.</li>
  </ol>

  <h3>3. Instagram y TikTok</h3>
  <ul>
    <li>En cada publicación toca <b>Agregar ubicación</b> y pon la ciudad (cámbiala en cada publicación).</li>
    <li>Agrega hashtags de la ciudad: <b>#medellin #ventasmedellin #bogota #cali #barranquilla</b> + <b>#contraentrega #envíogratis</b>.</li>
    <li>Pon en tu perfil el enlace de la tienda.</li>
  </ul>

  <h3>4. WhatsApp: tus conocidos en otras ciudades</h3>
  <ul>
    <li>Escríbeles <b>uno por uno</b> (no en cadena) y pídeles que compartan tu estado o el enlace de la tienda en su ciudad.</li>
  </ul>
</div>

<div class="guide">
  <h2>Plan de la semana por ciudades</h2>
  <p>Cada día, 3 publicaciones en Marketplace (una por producto) en la ciudad del día, y la misma imagen en 3 grupos de esa ciudad. Empieza siempre por los «Más vendido».</p>
  <table>
    <tr><th>Día</th><th>Marketplace (ubicación)</th><th>Grupos de</th></tr>
    ${SEMANA.map(([d, a, c]) => `<tr><td>${d}</td><td>${a}</td><td>${a} y ${c}</td></tr>`).join('')}
  </table>
  <p>La semana siguiente cambia los productos y repite las ciudades. Otras ciudades grandes para rotar: ${CIUDADES.slice(8).join(', ')}.</p>

  <h3>Cuando te escriba alguien de otra ciudad</h3>
  <div class="msg">¡Hola! 😊 Sí te lo enviamos a [ciudad]. Vale [precio], el envío es gratis y pagas en efectivo cuando te llega. Para enviártelo necesito:
Nombre completo:
Celular:
Ciudad:
Dirección y barrio:
¿Color o tamaño? (si aplica)</div>
  <h3>Para confirmar antes de despachar</h3>
  <div class="msg">¡Hola, [nombre]! Te confirmo tu pedido: [producto], cantidad [n], total [$], pago contra entrega.
Dirección: [dirección], [barrio], [ciudad].
¿Está todo bien y vas a estar para recibirlo? Respóndeme «sí» y lo despacho hoy 🙌</div>
  <div class="tip"><b>Importante:</b> si no te responde «sí» en 24 horas, no lo despaches. Cada pedido devuelto te cuesta el envío de ida y vuelta. En ciudades pequeñas o zonas rurales el envío puede tardar más: no prometas un día exacto, di «normalmente pocos días hábiles».</div>
  <h3>Cuánto se demora</h3>
  <p>Depende de la ciudad y de la bodega del proveedor. Apenas Dropi genere la guía, pásasela al cliente para que siga su pedido.</p>
</div>

<div class="prods">
  <h2>Tus productos (${texts.length})</h2>
  ${texts.map(card).join('')}
</div>
</body></html>`;
fs.writeFileSync(OUT + 'catalogo.html', html);
await p.goto('file://' + OUT + 'catalogo.html', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.pdf({ path: OUT + '3R-Market-catalogo-para-publicar.pdf', format: 'A4', printBackground: true });
fs.writeFileSync(OUT + 'textos.json', JSON.stringify(texts, null, 1));
console.log('ok', texts.length);
await b.close();

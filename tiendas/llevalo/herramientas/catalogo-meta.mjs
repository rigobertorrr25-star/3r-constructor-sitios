// Arma el archivo para subir el catálogo completo a Meta Commerce Manager (y de ahí a WhatsApp, Facebook e Instagram).
// Uso: node herramientas/catalogo-meta.mjs  →  catalogo/3R-Market-catalogo-Meta.csv
// Las fotos se leen desde la tienda publicada: img/catalogo/<id de Dropi>.jpg (tienen que estar publicadas antes de subir).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const BASE = '/home/user/3r-constructor-sitios/tiendas/llevalo/';
const URL = 'https://llevalo.rigoberto-rrr25.workers.dev';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + BASE + 'index.html');
const P = await p.evaluate(() => PRODUCTS.map(q => ({ id: q.dropi, name: q.name, desc: q.desc, price: q.price, sizes: q.sizes || null, colors: q.colors || null })));
const CATN = Object.fromEntries(await p.evaluate(() => CATS.map(c => [c.id, c.name])));
const CAT = Object.fromEntries(await p.evaluate(() => PRODUCTS.map(q => [q.dropi, q.cat])));
await b.close();
const cell = (v) => '"' + String(v).replace(/"/g, '""') + '"';
const rows = [['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand', 'item_group_id', 'size', 'color', 'custom_label_0']];
// Fuera del catálogo de Meta: suplementos (Meta no los permite). Amua sigue en la tienda web.
const FUERA = new Set([2312645]);
for (const q of P) {
  if (FUERA.has(q.id)) continue;
  const base = q.desc + (q.colors ? ' Colores: ' + q.colors.join(', ').toLowerCase() + ' (dinos cuál quieres al pedir).' : '') +
    ' Pagas en efectivo cuando te llega. Envío gratis a toda Colombia. Te confirmamos por WhatsApp antes de enviarlo.';
  const brand = /lattafa/i.test(q.name) ? 'Lattafa' : '3R Market';
  const img = `${URL}/img/catalogo/${q.id}.jpg`;
  const sec = CATN[CAT[q.id]] || '';
  if (q.sizes) {
    for (const z of q.sizes) rows.push([`3R-${q.id}-${z.ref}`, `${q.name} ${z.name}`, base, 'in stock', 'new', `${z.price} COP`, URL, img, brand, `3R-${q.id}`, z.name, '', sec]);
  } else {
    rows.push([`3R-${q.id}`, q.name, base, 'in stock', 'new', `${q.price} COP`, URL, img, brand, '', '', '', sec]);
  }
}
fs.mkdirSync(BASE + 'catalogo', { recursive: true });
fs.writeFileSync(BASE + 'catalogo/3R-Market-catalogo-Meta.csv', '﻿' + rows.map(r => r.map(cell).join(',')).join('\n') + '\n');
console.log('filas', rows.length - 1);

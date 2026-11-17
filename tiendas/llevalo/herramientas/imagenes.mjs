import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const out = '/home/user/3r-constructor-sitios/tiendas/llevalo/catalogo/imagenes';
fs.mkdirSync(out + '/cuadradas', { recursive: true }); fs.mkdirSync(out + '/historias', { recursive: true });
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file:///home/user/3r-constructor-sitios/tiendas/llevalo/index.html', { waitUntil: 'networkidle' });
const r5417 = 'data:image/jpeg;base64,' + fs.readFileSync('/home/user/3r-constructor-sitios/tiendas/llevalo/img/5417.jpg').toString('base64');
await p.evaluate((d) => { PRODUCTS.find(z => z.dropi === 5417).img = d; }, r5417);
const F = '/home/user/3r-constructor-sitios/tiendas/llevalo/catalogo/fotos/';
const mime = (buf) => buf[0] === 0x89 ? 'image/png' : buf[0] === 0xff ? 'image/jpeg' : buf.slice(0, 3).toString() === 'GIF' ? 'image/gif' : 'image/webp';
for (const f of fs.readdirSync(F)) { const id = +f.split('.')[0]; if (id === 5417) continue; const buf = id === 2238229 ? fs.readFileSync('/home/user/3r-constructor-sitios/tiendas/llevalo/img/2238229.jpg') : fs.readFileSync(F + f);
  await p.evaluate(([id, d]) => { const q = PRODUCTS.find(z => z.dropi === id); q.img = d; delete q.cardImg; }, [id, 'data:' + mime(buf) + ';base64,' + buf.toString('base64')]); }
console.log('fuentes:', await p.evaluate(async () => { await document.fonts.ready; return document.fonts.check('64px "Archivo Black"'); }));
const ids = await p.evaluate(() => PRODUCTS.map(q => q.dropi));
for (const id of ids) for (const story of [false, true]) {
  const r = await p.evaluate(async ([id, story]) => {
    const q = PRODUCTS.find(z => z.dropi === id);
    const c = await drawCard(q, story);
    const slug = q.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return { slug, data: c.toDataURL('image/jpeg', 0.9) };
  }, [id, story]);
  fs.writeFileSync(`${out}/${story ? 'historias' : 'cuadradas'}/${r.slug}${story ? '-historia' : ''}.jpg`, Buffer.from(r.data.split(',')[1], 'base64'));
}
console.log('ok', ids.length);
await b.close();

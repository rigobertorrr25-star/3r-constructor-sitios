import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const dir = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
for (const id of ['p1','p2','p3','p4','p5']) {
  await p.goto(`file://${dir}/posts.html?${id}`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.locator('#' + id).screenshot({ path: `${dir}/${id}.jpg`, type: 'jpeg', quality: 92 });
}
await b.close();
console.log('ok');

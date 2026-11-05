import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const dir = process.argv[2];
const b = await chromium.launch();
for (const [id, h] of [['p6', 1350], ['p7', 1350], ['e1', 1920]]) {
  const p = await b.newPage({ viewport: { width: 1080, height: h } });
  await p.goto(`file://${dir}/posts.html?${id}`);
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.locator('#' + id).screenshot({ path: `${dir}/${id}.${id === 'e1' ? 'png' : 'jpg'}`, ...(id === 'e1' ? {} : { type: 'jpeg', quality: 92 }) });
  await p.close();
}
await b.close(); console.log('ok');

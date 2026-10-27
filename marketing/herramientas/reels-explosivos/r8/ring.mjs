import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 220, height: 220 } });
await p.goto('file://' + process.argv[2] + '/ring.html');
await p.screenshot({ path: process.argv[2] + '/ring1.png', omitBackground: true });
await p.evaluate(() => { const r = document.getElementById('r'); r.style.width = '190px'; r.style.height = '190px'; r.style.borderWidth = '6px'; r.style.background = 'transparent'; });
await p.screenshot({ path: process.argv[2] + '/ring2.png', omitBackground: true }); await b.close();

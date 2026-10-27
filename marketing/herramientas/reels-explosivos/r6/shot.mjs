import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto('file://' + process.argv[2] + '/' + process.argv[3]); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
await p.screenshot({ path: process.argv[2] + '/' + process.argv[4], fullPage: true }); await b.close();

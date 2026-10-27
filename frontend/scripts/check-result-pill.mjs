// Browser check: the reveal pill stays inside .sg-field at 360, 390 and 1280.
// Usage: BASE=http://localhost:3000 node scripts/check-result-pill.mjs  (needs `playwright` installed locally)
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch();
let bad = 0;
for (const width of [360, 390, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: width > 400 ? 800 : 780 } });
  await page.goto(`${base}/daily`);
  for (let i = 0; i < 5; i++) {
    await page.locator(".sg-btn").first().click({ timeout: 15000 });
    const pill = page.locator(".sg-field .sg-pill");
    await pill.waitFor();
    const [p, f] = await Promise.all([pill.boundingBox(), page.locator(".sg-field").boundingBox()]);
    const ok = p && f && p.x >= f.x && p.y >= f.y && p.x + p.width <= f.x + f.width + 0.5 && p.y + p.height <= f.y + f.height + 0.5;
    console.log(`${width}px play ${i + 1}: ${ok ? "inside" : "OUTSIDE"} "${await pill.textContent()}"`);
    if (!ok) bad++;
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/pill-${width}-${i + 1}.png` });
    const next = page.locator(".sg-next");
    if (!(await next.count())) break;
    await next.click();
  }
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);

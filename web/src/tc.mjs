import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const p of ['/', '/pricing']) {
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('http://localhost:3000' + p, { waitUntil: 'networkidle', timeout: 180000 });
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += 800) { await page.mouse.wheel(0, 800); await page.waitForTimeout(80); }
  await page.waitForTimeout(500);
  const t = await page.evaluate(() => ({
    testCheckout: /Test Checkout|Sandbox \/ Test Only|4242 4242/.test(document.body.innerText),
    lemonInDom: document.body.innerHTML.includes('lemonsqueezy.com/checkout/buy/2ccc5601'),
  }));
  console.log(p, 'testCheckoutVisible=' + t.testCheckout, 'testUrlInDom=' + t.lemonInDom);
  await page.close();
}
await b.close();

// Captures the real agency overview (demo data) for the /agencies landing page, dark and light, so
// the preview there is the dashboard itself rather than a drawing of it. Run against a local server:
//   npx next dev -p 3000   (NEXT_PUBLIC_IS_ENTERPRISE=true)
//   node scripts/agency-screenshots.mjs [http://localhost:3000] [path/to/@playwright/test/index.mjs]
// and commit the two images in public/images/agency/.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.argv[2] ?? 'http://localhost:3000';
const playwrightPath = process.argv[3] ?? '@playwright/test';
const { chromium } = await import(playwrightPath);
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'images', 'agency');

const browser = await chromium.launch();
for (const theme of ['dark', 'light']) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: theme });
  await context.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  const page = await context.newPage();
  await page.goto(`${base}/agency?demo=1`);
  // The Next.js dev badge is not part of the product.
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await page.getByRole('heading', { name: 'Overview' }).first().waitFor();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, `overview-${theme}.png`) });
  await context.close();
}
await browser.close();
console.log(`saved ${out}/overview-{dark,light}.png`);

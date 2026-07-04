import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', msg => logs.push(`${msg.type()}: ${msg.text()}`));
page.on('pageerror', err => logs.push(`pageerror: ${err.message}`));
for (const path of ['/en', '/en/auth/login', '/en/auth/register', '/en/pricing']) {
  await page.goto(`https://imagic.art${path}?v=${Date.now()}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  const title = await page.title();
  const text = (await page.locator('body').innerText({ timeout: 10000 })).replace(/\s+/g, ' ').slice(0, 1600);
  const shot = `/tmp/imagic-live-v11-${path.replaceAll('/','_') || 'root'}.png`;
  await page.screenshot({ path: shot, fullPage: true });
  console.log(`\n### ${path}`);
  console.log(JSON.stringify({ title, url: page.url(), screenshot: shot, text }, null, 2));
}
console.log('\n### fallback logs');
console.log(logs.filter((line) => /fallback|failed|error|imagic-studio|ThemeProvider/i.test(line)).slice(-120).join('\n'));
await browser.close();

import { chromium } from 'playwright';
const pages = [
  ['/en', ['imagic.art', 'Create visuals', 'image + magic = imagic']],
  ['/en/auth/login', ['Welcome back', 'Sign in']],
  ['/en/auth/register', ['Create account']],
  ['/en/pricing', ['Credits']],
];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const results = [];
for (const [path, texts] of pages) {
  const errors = [];
  page.removeAllListeners('console');
  page.on('console', (msg) => {
    const text = msg.text();
    if (/ThemeProvider.*falling back|has no packaged runtime/i.test(text)) errors.push(text);
  });
  const url = `https://imagic.art${path}`;
  const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  const body = await page.locator('body').innerText({ timeout: 15000 });
  const missing = texts.filter((t) => !body.includes(t));
  const shot = `/tmp/imagic-current-${path.replace(/\W+/g, '_') || 'home'}.png`;
  await page.screenshot({ path: shot, fullPage: true });
  results.push({ url, status: res?.status(), missing, themeFallbackErrors: errors, screenshot: shot });
}
await browser.close();
console.log(JSON.stringify(results, null, 2));

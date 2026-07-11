import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(`file://${resolve(__dirname, 'web-system-initialization.html')}`, { waitUntil: 'networkidle' });
await page.screenshot({ path: resolve(__dirname, 'jiffoo-web-system-initialization.png') });

const mobile = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true });
await mobile.goto(`file://${resolve(__dirname, 'mobile-system-initialization.html')}`, { waitUntil: 'networkidle' });
await mobile.screenshot({ path: resolve(__dirname, 'jiffoo-mobile-system-initialization.png') });
await browser.close();

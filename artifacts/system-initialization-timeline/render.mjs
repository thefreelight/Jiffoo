import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();

const web = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await web.goto(`file://${resolve(__dirname, 'web-timeline-admin-setup.html')}`, { waitUntil: 'networkidle' });
await web.screenshot({ path: resolve(__dirname, 'jiffoo-web-timeline-admin-setup.png') });

const mobile = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true });
await mobile.goto(`file://${resolve(__dirname, 'mobile-timeline-admin-setup.html')}`, { waitUntil: 'networkidle' });
await mobile.screenshot({ path: resolve(__dirname, 'jiffoo-mobile-timeline-admin-setup.png') });

await browser.close();

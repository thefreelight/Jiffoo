const { chromium } = require('playwright');

(async () => {
  console.log('开始连接...');
  const browser = await Promise.race([
    chromium.connectOverCDP('http://127.0.0.1:9222'),
    new Promise((_, rej) => setTimeout(() => rej(new Error('connect timeout')), 10000))
  ]);
  console.log('已连接');
  
  const ctx = browser.contexts()[0];
  const pages = ctx.pages();
  console.log('页面数:', pages.length);
  
  const page = pages.find(p => p.url().includes('api-tokens'));
  if (!page) { console.log('没找到token页, 所有URL:', pages.map(p=>p.url().substring(0,50)).join(',')); process.exit(1); }
  
  console.log('找到页面:', page.url());
  
  // 填令牌名称
  const nameInput = page.locator('input[type="text"]').first();
  await nameInput.fill('jiffoo-wrangler', { timeout: 5000 });
  console.log('已填名称');
  
  await page.screenshot({ path: '/tmp/token-filled.png' });
  console.log('截图已保存');
  
  browser.close();
  console.log('完成');
})().catch(e => { console.error('错误:', e.message); process.exit(1); });

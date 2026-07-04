const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const ctx = browser.contexts()[0];
  const pages = ctx.pages();
  const page = pages.find(p => p.url().includes('api-tokens/create'));
  if (!page) { console.log('没找到token页'); process.exit(1); }
  
  console.log('当前URL:', page.url());
  
  // 截图
  await page.screenshot({ path: '/tmp/token-page.png' });
  console.log('截图1已保存');
  
  // 看页面上的input和button
  const inputs = await page.locator('input').count();
  console.log('input数量:', inputs);
  
  // 找文本输入框（不是checkbox/search）
  const textInputs = await page.locator('input[type="text"], input:not([type])').count();
  console.log('文本input数量:', textInputs);
  
  // 填令牌名称
  if (textInputs > 0) {
    const nameInput = page.locator('input[type="text"], input:not([type])').first();
    await nameInput.fill('jiffoo-wrangler');
    console.log('已填令牌名称');
  }
  
  await page.screenshot({ path: '/tmp/token-name-filled.png' });
  console.log('截图2已保存');
  
  // 列出所有按钮
  const btns = await page.locator('button').allTextContents();
  const visibleBtns = btns.filter(b => b.trim().length > 0 && b.trim().length < 40);
  console.log('按钮:', visibleBtns.join(' | '));
  
  // 不close browser，只disconnect
  browser.close();
})().catch(e => { console.error('错误:', e.message); process.exit(1); });

import { expect, test } from './local-requests';
import type { APIRequestContext, ConsoleMessage, Frame, Page, Request } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { api, ownerEmail } from './helpers';

const shopOrigin = 'http://127.0.0.1:3003';
const adminPath = 'http://127.0.0.1:3001/api/v1/admin/storefront-code';
const markerText = 'runs:1|order:head,external,dependent,start,nested,end|headParent:true|startFirst:true|endLast:true';
const empty = {
  ga4MeasurementId: null, metaPixelId: null, baiduSiteKey: null,
  headCode: '', bodyStartCode: '', bodyEndCode: '',
};
type Slots = Pick<typeof empty, 'headCode' | 'bodyStartCode' | 'bodyEndCode'>;
let token: string;
let faviconProven = false;
const faviconUrl = `${shopOrigin}/favicon.ico`;
test.describe.configure({ mode: 'serial' });

async function configuration(request: APIRequestContext, slots: Slots = empty) {
  const headers = { authorization: `Bearer ${token}` };
  const current = await request.get(adminPath, { headers });
  expect(current.ok()).toBe(true);
  const { data } = await current.json();
  const saved = await request.put(adminPath, { headers, data: { ...empty, ...slots, expectedRevision: data.revision } });
  expect(saved.ok(), await saved.text()).toBe(true);
}

async function switchCode(request: APIRequestContext, enabled: boolean) {
  const response = await request.post(`${adminPath}/switch`, {
    headers: { authorization: `Bearer ${token}` }, data: { enabled },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

test.beforeAll(async ({ request }) => {
  const result = await api<{ token: string }>(request, '/auth/login', {
    method: 'POST', data: { email: ownerEmail, password: 'FinalOwnerPassword123!' },
  });
  token = result.token;
});
test.beforeEach(async ({ request }) => {
  await configuration(request);
  await switchCode(request, true);
});
test.afterEach(async ({ request }) => {
  await configuration(request);
  await switchCode(request, true);
});

function slots(probe = randomUUID(), headExtra = ''): Slots {
  const external = `data:text/javascript,${encodeURIComponent("window.merchantCode.order.push('external');window.merchantCode.externalReady=true;")}`;
  return {
    headCode: `<style>.merchant-code-marker { color: rgb(17, 34, 51); }</style><script>
window.merchantCode={runs:(window.merchantCode?.runs||0)+1,order:['head'],headParent:document.currentScript.parentNode===document.head};
window.merchantCode.probe=()=>{const image=new Image();image.src='http://127.0.0.1:3001/api/v1/store/storefront-code?merchantProbe=${probe}&tick='+performance.now();};
window.merchantCode.probe();window.merchantCode.timer=setInterval(window.merchantCode.probe,50);
</script>${headExtra}<script src="${external}"></script><script>
if(!window.merchantCode.externalReady)throw new Error('Merchant external dependency missing');
window.merchantCode.order.push('dependent');
</script>`,
    bodyStartCode: `<script>
window.merchantCode.startFirst=document.currentScript===document.body.firstChild;
window.merchantCode.order.push('start');
</script><div><script>window.merchantCode.order.push('nested');</script></div>`,
    bodyEndCode: `<script>
window.merchantCode.endLast=document.currentScript===document.body.lastChild;
window.merchantCode.order.push('end');
const marker=document.createElement('div');marker.className='merchant-code-marker';
const state=window.merchantCode;
marker.textContent='runs:'+state.runs+'|order:'+state.order.join(',')+'|headParent:'+state.headParent+'|startFirst:'+state.startFirst+'|endLast:'+state.endLast;
document.body.appendChild(marker);
</script>`,
  };
}

async function expectMarker(page: Page) {
  const marker = page.getByText(markerText, { exact: true });
  await expect(marker).toHaveCount(1);
  await expect(marker).toBeVisible();
  return marker;
}

function observe(page: Page, probe: string) {
  const pageErrors: string[] = [];
  const consoleMessages: Array<{ type: string; text: string; url: string }> = [];
  const probes: string[] = [];
  const documentProbes: string[] = [];
  const afterPayment: string[] = [];
  const navigationCounts: Array<{ url: string; beforeCommit: number; afterCommit: number; committed: boolean }> = [];
  let pending: typeof navigationCounts[number] | undefined;
  let active: typeof pending;
  let paymentDocument = false;
  const onRequest = (request: Request) => {
    const url = new URL(request.url());
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      pending = { url: request.url(), beforeCommit: 0, afterCommit: 0, committed: false };
      navigationCounts.push(pending);
    }
    if (url.searchParams.get('merchantProbe') === probe) {
      probes.push(request.url());
      if (pending && !pending.committed) pending.beforeCommit += 1;
      else if (active) {
        active.afterCommit += 1;
        documentProbes.push(request.url());
        if (paymentDocument) afterPayment.push(request.url());
      }
    }
  };
  const onCommit = (frame: Frame) => {
    if (frame !== page.mainFrame() || !pending || frame.url() !== pending.url) return;
    pending.committed = true;
    active = pending;
    documentProbes.length = 0;
    paymentDocument = /^\/en\/checkout(?:\/cancel)?$/.test(new URL(frame.url()).pathname);
  };
  const onConsole = (message: ConsoleMessage) => {
    consoleMessages.push({ type: message.type(), text: message.text(), url: message.location().url });
  };
  const onError = (error: Error) => pageErrors.push(error.message);
  page.on('request', onRequest);
  page.on('console', onConsole);
  page.on('pageerror', onError);
  page.on('framenavigated', onCommit);
  return {
    pageErrors, consoleMessages, probes, documentProbes, afterPayment, navigationCounts,
    resetPayment() { paymentDocument = false; afterPayment.length = 0; },
    stop() {
      page.off('request', onRequest); page.off('console', onConsole); page.off('pageerror', onError);
      page.off('framenavigated', onCommit);
    },
  };
}

function assertRuntime(observation: ReturnType<typeof observe>, errors: string[] = [], warnings: string[] = []) {
  expect(faviconProven, 'The empty-config document must prove the favicon exception first').toBe(true);
  expect(observation.pageErrors).toEqual(errors);
  expect(observation.consoleMessages.filter((message) =>
    /hydrat|(?:minified\s+)?React error #\d+|react\.dev\/errors\/\d+/i.test(message.text))).toEqual([]);
  expect(observation.consoleMessages.filter((message) => message.type === 'error' &&
    !(message.url === faviconUrl && /^Failed to load resource:/.test(message.text)))).toEqual([]);
  expect(observation.consoleMessages.filter((message) => message.type === 'warning').map((message) => message.text))
    .toEqual(warnings);
}

test('J empty-config home reproduces the pre-existing favicon 404 without a loader', async ({ page, request }) => {
  const data = await api<typeof empty>(request, '/store/storefront-code');
  expect(data).toEqual(empty);
  const observation = observe(page, randomUUID());
  const favicon = new Promise<{ text: string; url: string }>((resolve) => {
    page.on('console', (message) => {
      if (message.type() === 'error' && message.location().url === faviconUrl) {
        resolve({ text: message.text(), url: message.location().url });
      }
    });
  });
  try {
    const response = await page.goto(`${shopOrigin}/en`);
    expect(response?.ok()).toBe(true);
    expect(await response!.text()).not.toContain('StorefrontCodeLoader');
    await expect(page.getByRole('link', { name: 'E2E Updated Store', exact: true })).toBeVisible();
    await expect(page.getByText(markerText, { exact: true })).toHaveCount(0);
    const proof = await favicon;
    expect(proof).toEqual({
      text: 'Failed to load resource: the server responded with a status of 404 (Not Found)',
      url: faviconUrl,
    });
    faviconProven = true;
    assertRuntime(observation);
    console.log('Empty-config favicon proof:', JSON.stringify(proof));
  } finally { observation.stop(); }
});

async function buyerWithCart(page: Page, request: APIRequestContext, label: string) {
  const id = randomUUID();
  const productName = `Merchant Code ${label} Product ${id.slice(0, 8)}`;
  await api(request, '/admin/products', {
    method: 'POST', token, data: {
      name: productName, requiresShipping: true,
      variants: [{ name: 'Standard', salePrice: 12, stock: 3, skuCode: `MERCHANT-CODE-${id}` }],
    },
  });
  await page.goto(`${shopOrigin}/en/register`);
  await page.getByLabel('Name').fill(`Merchant Code ${label} Buyer`);
  await page.getByLabel('Email').fill(`merchant-code-${label}-${id}@e2e.example`);
  await page.getByLabel('Password', { exact: true }).fill('MerchantCodePassword123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(`${shopOrigin}/en/account`);
  await page.goto(`${shopOrigin}/en/products`);
  await page.getByRole('searchbox', { name: 'Search products', exact: true }).fill(productName);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('heading', { name: productName, exact: true }).click();
  await expect(page.getByRole('heading', { name: productName, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page).toHaveURL(`${shopOrigin}/en/cart`);
  return productName;
}

async function placeOrder(page: Page) {
  await page.getByLabel('First name').fill('Merchant');
  await page.getByLabel('Last name').fill('Code Buyer');
  await page.getByLabel('Phone').fill('+1-555-0123');
  await page.getByLabel('Address line 1').fill('23 Merchant Street');
  await page.getByRole('textbox', { name: 'City', exact: true }).fill('San Francisco');
  await page.getByLabel('State / province').fill('CA');
  await page.getByLabel('Postal code').fill('94105');
  await page.getByRole('combobox', { name: 'Country', exact: true }).selectOption('US');
  await page.getByRole('button', { name: 'Get shipping options', exact: true }).click();
  await page.getByRole('radio', { name: /Free shipping/i }).check();
  await page.getByRole('radio', { name: 'Manual payment', exact: true }).check();
  await page.getByRole('button', { name: 'Place order', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/checkout\/complete\?order=/);
  await expect(page.getByRole('heading', { name: 'Order confirmation', exact: true })).toBeVisible();
  const id = new URL(page.url()).searchParams.get('order');
  expect(id).toBeTruthy();
  return id!;
}

test('A injects ordered head and body slots with blocking external dependencies and head styles', async ({ page, request }) => {
  const probe = randomUUID();
  await configuration(request, slots(probe));
  const observation = observe(page, probe);
  try {
    await page.goto(`${shopOrigin}/en`);
    await expect(await expectMarker(page)).toHaveCSS('color', 'rgb(17, 34, 51)');
    assertRuntime(observation);
    expect(observation.probes.length).toBeGreaterThan(0);
  } finally { observation.stop(); }
});

test('B soft navigation and locale switching retain one injection without hydration errors', async ({ page, request }) => {
  const probe = randomUUID();
  await configuration(request, slots(probe));
  const observation = observe(page, probe);
  const documents: string[] = [];
  page.on('request', (entry) => {
    if (entry.isNavigationRequest() && entry.frame() === page.mainFrame()) documents.push(entry.url());
  });
  try {
    await page.goto(`${shopOrigin}/en`);
    await expectMarker(page);
    await page.getByRole('link', { name: 'E2E Translated Category', exact: true }).first().click();
    await expect(page).toHaveURL(`${shopOrigin}/en/categories/e2e-translated-category`);
    await expectMarker(page);
    await page.getByRole('heading', { name: 'E2E Localized Product', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'E2E Localized Product', exact: true })).toBeVisible();
    await expectMarker(page);
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('zh-Hans');
    await expect(page).toHaveURL(/\/zh-Hans\/products\//);
    await expectMarker(page);
    expect(documents).toEqual([`${shopOrigin}/en`]);
    assertRuntime(observation);
  } finally { observation.stop(); }
});

test('C a full reload injects once in the new document', async ({ page, request }) => {
  const probe = randomUUID();
  await configuration(request, slots(probe));
  const observation = observe(page, probe);
  try {
    await page.goto(`${shopOrigin}/en`);
    await expectMarker(page);
    const response = await page.reload();
    expect(response?.request().isNavigationRequest()).toBe(true);
    await expectMarker(page);
    assertRuntime(observation);
  } finally { observation.stop(); }
});

test('D order completion runs merchant code on the confirmation document', async ({ page, request }) => {
  await buyerWithCart(page, request, 'd');
  const probe = randomUUID();
  await configuration(request, slots(probe));
  const observation = observe(page, probe);
  try {
    await page.getByRole('link', { name: 'Checkout', exact: true }).click();
    await expect(page.getByLabel('First name')).toBeVisible();
    await expect(page.getByText(markerText, { exact: true })).toHaveCount(0);
    await placeOrder(page);
    await expectMarker(page);
    assertRuntime(observation);
  } finally { observation.stop(); }
});

test('E payment documents exclude code and stop prior probes on direct and storefront arrivals', async ({ page, request }) => {
  const productName = await buyerWithCart(page, request, 'e');
  await page.getByRole('link', { name: 'Checkout', exact: true }).click();
  const id = await placeOrder(page);
  await page.goto(`${shopOrigin}/en/products`);
  await page.getByRole('searchbox', { name: 'Search products', exact: true }).fill(productName);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('heading', { name: productName, exact: true }).click();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page).toHaveURL(`${shopOrigin}/en/cart`);
  const probe = randomUUID();
  const code = slots(probe);
  code.bodyEndCode += `<a href="/en/checkout/cancel?order=${id}">Merchant cancel destination</a>`;
  await configuration(request, code);
  const observation = observe(page, probe);
  try {
    for (const [path, heading] of [
      ['/en/checkout', 'Checkout'], [`/en/checkout/cancel?order=${id}`, 'Payment pending'],
    ]) {
      observation.resetPayment();
      await page.goto(`${shopOrigin}${path}`);
      await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
      await expect(page.getByText(markerText, { exact: true })).toHaveCount(0);
      expect(observation.afterPayment).toEqual([]);
    }
    observation.resetPayment();
    await page.goto(`${shopOrigin}/en/cart`);
    await expectMarker(page);
    expect(observation.probes.length).toBeGreaterThan(0);
    await page.getByRole('link', { name: 'Checkout', exact: true }).click();
    await expect(page.getByLabel('First name')).toBeVisible();
    await page.getByLabel('First name').fill('Payment exclusion');
    await expect(page.getByLabel('First name')).toHaveValue('Payment exclusion');
    await expect(page.getByText(markerText, { exact: true })).toHaveCount(0);
    expect(observation.afterPayment).toEqual([]);
    observation.resetPayment();
    await page.goto(`${shopOrigin}/en`);
    await expectMarker(page);
    await page.getByRole('link', { name: 'Merchant cancel destination', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Payment pending', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View order', exact: true })).toBeVisible();
    await expect(page.getByText(markerText, { exact: true })).toHaveCount(0);
    expect(observation.afterPayment).toEqual([]);
    assertRuntime(observation);
    const counts = observation.navigationCounts.filter((entry) =>
      /^\/en\/checkout(?:\/cancel)?$/.test(new URL(entry.url).pathname));
    expect(counts).toHaveLength(4);
    for (const entry of counts) {
      expect(entry.committed).toBe(true);
      expect(entry.afterCommit).toBe(0);
    }
    console.log('E payment document probe counts:', JSON.stringify(counts));
  } finally { observation.stop(); }
});

test('F the master switch suppresses code and probes until enabled on a new document', async ({ page, request }) => {
  const probe = randomUUID();
  await configuration(request, slots(probe));
  await page.goto(`${shopOrigin}/en`);
  await expectMarker(page);
  await switchCode(request, false);
  const observation = observe(page, probe);
  try {
    await page.reload();
    await expect(page.getByRole('link', { name: 'E2E Updated Store', exact: true })).toBeVisible();
    await expect(page.getByText(markerText, { exact: true })).toHaveCount(0);
    expect(observation.documentProbes).toEqual([]);
    await switchCode(request, true);
    await page.reload();
    await expectMarker(page);
    expect(observation.documentProbes.length).toBeGreaterThan(0);
    expect(observation.navigationCounts).toHaveLength(2);
    expect(observation.navigationCounts[0].committed).toBe(true);
    expect(observation.navigationCounts[0].afterCommit).toBe(0);
    expect(observation.navigationCounts[1].committed).toBe(true);
    assertRuntime(observation);
    console.log('F reload document probe counts:', JSON.stringify(observation.navigationCounts));
  } finally { observation.stop(); }
});

test('G document.write is guarded without blanking the page or stopping later scripts', async ({ page, request }) => {
  const probe = randomUUID();
  await configuration(request, slots(probe, "<script>document.write('Merchant destructive write');</script>"));
  const observation = observe(page, probe);
  try {
    await page.goto(`${shopOrigin}/en`);
    await expectMarker(page);
    await expect(page.getByRole('link', { name: 'E2E Updated Store', exact: true })).toBeVisible();
    await expect(page.getByText('Merchant destructive write', { exact: true })).toHaveCount(0);
    assertRuntime(observation, [], ['Storefront code blocked document.write']);
  } finally { observation.stop(); }
});

test('H an inline script error is reported once while later scripts still execute', async ({ page, request }) => {
  const probe = randomUUID();
  await configuration(request, slots(probe, "<script>throw new Error('Merchant deliberate error');</script>"));
  const observation = observe(page, probe);
  try {
    await page.goto(`${shopOrigin}/en`);
    await expectMarker(page);
    assertRuntime(observation, ['Merchant deliberate error']);
  } finally { observation.stop(); }
});

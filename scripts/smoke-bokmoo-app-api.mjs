#!/usr/bin/env node

import { createHmac } from 'node:crypto';

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = 'true';
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/smoke-bokmoo-app-api.mjs --base-url https://api.bokmoo.com

Options:
  --base-url             API origin or /api base URL. Defaults to env BOKMOO_API_BASE_URL or https://api.bokmoo.com.
  --country              eSIM country filter for product smoke. Defaults to JP.
  --product-id           Product ID to verify. Defaults to the first product returned by the list check.
  --user-token           Customer JWT for authenticated app checks.
  --support-token        Support JWT with support:read scope for support queue/search checks.
  --order-id             Existing order ID used for order detail and install-session gate checks.
  --card-id              Existing card identifier used for card detail checks.
  --create-ticket        Create a temporary user support ticket. Requires --user-token.
  --reset-identifier     Run password reset request for this email/phone.
  --send-order-paid      Send a signed Jiffoo order-paid webhook. Requires --webhook-secret, --order-id, and --webhook-user-id.
  --webhook-user-id      User ID for the optional signed order-paid webhook.
  --webhook-secret       Jiffoo/BOKMOO webhook secret for the optional signed order-paid webhook.

Environment:
  BOKMOO_API_BASE_URL
  BOKMOO_SMOKE_USER_TOKEN
  BOKMOO_SMOKE_SUPPORT_TOKEN
  BOKMOO_JIFFOO_WEBHOOK_SECRET

Behavior:
  - safe checks run by default: products, social-auth route presence, payment webhook alias
  - authenticated reads run only when --user-token is supplied
  - support reads run only when --support-token is supplied
  - write checks are opt-in with --create-ticket, --reset-identifier, or --send-order-paid
`);
}

const args = parseArgs(process.argv.slice(2));

if (args.help === 'true') {
  printHelp();
  process.exit(0);
}

function normalizeBaseUrl(input) {
  const raw = String(input || '').trim().replace(/\/+$/, '');
  if (!raw) return 'https://api.bokmoo.com/api';
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

const baseUrl = normalizeBaseUrl(args['base-url'] || process.env.BOKMOO_API_BASE_URL || 'https://api.bokmoo.com');
const country = args.country || process.env.BOKMOO_SMOKE_COUNTRY || 'JP';
const userToken = args['user-token'] || process.env.BOKMOO_SMOKE_USER_TOKEN;
const supportToken = args['support-token'] || process.env.BOKMOO_SMOKE_SUPPORT_TOKEN;
const webhookSecret = args['webhook-secret'] || process.env.BOKMOO_JIFFOO_WEBHOOK_SECRET;

function headers(token, extra = {}) {
  return {
    accept: 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function request(method, path, options = {}) {
  const body = options.body;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(options.token, body ? { 'content-type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }

  return {
    status: response.status,
    ok: response.ok,
    payload,
  };
}

function payloadData(payload) {
  return payload?.data;
}

function messageFrom(payload) {
  return payload?.error?.message || payload?.message || payload?.raw || JSON.stringify(payload);
}

function assertStatus(name, result, expectedStatuses) {
  if (!expectedStatuses.includes(result.status)) {
    throw new Error(`${name} expected status ${expectedStatuses.join('/')} but got ${result.status}: ${messageFrom(result.payload)}`);
  }
}

function assertOk(name, result) {
  if (!result.ok) {
    throw new Error(`${name} failed with HTTP ${result.status}: ${messageFrom(result.payload)}`);
  }
  if (!result.payload || !Object.prototype.hasOwnProperty.call(result.payload, 'data')) {
    throw new Error(`${name} did not return a data envelope`);
  }
}

function containsActivationSecret(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsActivationSecret);

  for (const [key, nested] of Object.entries(value)) {
    if (['qrCode', 'lpaString', 'activationCode', 'smdpAddress', 'confirmationCode'].includes(key) && nested) {
      return true;
    }
    if (containsActivationSecret(nested)) return true;
  }
  return false;
}

function printCheck(name) {
  console.log(`check: ${name}`);
}

async function checkPublicProducts() {
  const list = await request('GET', `/products?type=esim&country=${encodeURIComponent(country)}&page=1&limit=12`);
  assertOk(`GET /products?type=esim&country=${country}`, list);

  const items = payloadData(list.payload)?.items;
  if (!Array.isArray(items)) {
    throw new Error('Product list data.items is not an array');
  }
  if (items.length === 0) {
    throw new Error(`No public eSIM products found for country=${country}`);
  }
  printCheck(`products list returned ${items.length} ${country} eSIM product(s)`);

  const productId = args['product-id'] || items[0]?.id;
  if (productId) {
    const detail = await request('GET', `/products/${encodeURIComponent(productId)}`);
    assertOk(`GET /products/${productId}`, detail);
    printCheck(`product detail returned ${productId}`);
  }
}

async function checkAuthRoutePresence() {
  const google = await request('POST', '/auth/google', { body: { idToken: '__bokmoo_smoke_invalid_google_token__' } });
  assertStatus('POST /auth/google route presence', google, [400, 401, 503]);
  printCheck(`/auth/google is routed (${google.status})`);

  const apple = await request('POST', '/auth/apple', { body: { identityToken: '__bokmoo_smoke_invalid_apple_token__' } });
  assertStatus('POST /auth/apple route presence', apple, [400, 401, 503]);
  printCheck(`/auth/apple is routed (${apple.status})`);

  const resetIdentifier = args['reset-identifier'];
  if (resetIdentifier) {
    const reset = await request('POST', '/auth/password-reset', {
      body: resetIdentifier.includes('@') ? { email: resetIdentifier } : { phone: resetIdentifier },
    });
    assertOk('POST /auth/password-reset', reset);
    printCheck('/auth/password-reset accepted request');
  }
}

async function checkPaymentWebhookAlias() {
  const response = await request('POST', '/payments/webhooks/stripe', {
    body: {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: `cs_bokmoo_smoke_${Date.now()}`,
        },
      },
    },
  });
  assertOk('POST /payments/webhooks/stripe', response);
  if (payloadData(response.payload)?.received !== true) {
    throw new Error('Payment webhook alias did not return received=true');
  }
  printCheck('/payments/webhooks/stripe returned received=true');
}

async function checkUserApi() {
  if (!userToken) {
    console.log('skip: authenticated customer checks; pass --user-token or BOKMOO_SMOKE_USER_TOKEN');
    return;
  }

  const account = await request('GET', '/account', { token: userToken });
  assertOk('GET /account', account);
  if (!payloadData(account.payload)?.account?.id) {
    throw new Error('GET /account did not include account.id');
  }
  printCheck('/account returned current account');

  for (const [name, path] of [
    ['payment methods', '/payment-methods'],
    ['orders', '/orders?page=1&limit=5'],
    ['cards', '/cards?page=1&limit=10'],
    ['profiles', '/profiles?page=1&limit=10'],
    ['notifications', '/notifications?page=1&limit=10'],
  ]) {
    const response = await request('GET', path, { token: userToken });
    assertOk(`GET ${path}`, response);
    const items = payloadData(response.payload)?.items;
    if (items !== undefined && !Array.isArray(items)) {
      throw new Error(`${name} response items is not an array`);
    }
    printCheck(`${name} endpoint returned data`);
  }

  if (args['card-id']) {
    const card = await request('GET', `/cards/${encodeURIComponent(args['card-id'])}`, { token: userToken });
    assertOk(`GET /cards/${args['card-id']}`, card);
    printCheck(`card detail returned ${args['card-id']}`);
  }

  if (args['order-id']) {
    const orderId = args['order-id'];
    const order = await request('GET', `/orders/${encodeURIComponent(orderId)}`, { token: userToken });
    assertOk(`GET /orders/${orderId}`, order);
    printCheck(`order detail returned ${orderId}`);

    const session = await request('GET', `/orders/${encodeURIComponent(orderId)}/install-session`, { token: userToken });
    if (session.ok) {
      if (!payloadData(session.payload)?.lpaString || !payloadData(session.payload)?.activationCode) {
        throw new Error('install-session succeeded but did not include LPA/activation payload');
      }
      printCheck(`install-session returned ready payload for ${orderId}`);
    } else {
      assertStatus(`GET /orders/${orderId}/install-session gate`, session, [403, 404, 409]);
      if (containsActivationSecret(session.payload)) {
        throw new Error('install-session error response leaked activation payload');
      }
      printCheck(`install-session safely blocked without activation leak (${session.status})`);
    }
  }

  if (args['create-ticket'] === 'true') {
    const ticket = await request('POST', '/support/tickets', {
      token: userToken,
      body: {
        subject: `BOKMOO smoke ${new Date().toISOString()}`,
        message: 'Automated production smoke ticket. It is safe to close.',
        priority: 'low',
        metadata: {
          source: 'smoke-bokmoo-app-api',
        },
      },
    });
    assertOk('POST /support/tickets', ticket);
    printCheck(`created support ticket ${payloadData(ticket.payload)?.id || ''}`.trim());
  }
}

async function checkSupportApi() {
  if (!supportToken) {
    console.log('skip: support checks; pass --support-token or BOKMOO_SMOKE_SUPPORT_TOKEN');
    return;
  }

  const tickets = await request('GET', '/support/tickets?page=1&limit=5', { token: supportToken });
  assertOk('GET /support/tickets', tickets);
  printCheck('/support/tickets returned support queue');

  const cards = await request('GET', '/support/cards/search?q=bokmoo-smoke&limit=5', { token: supportToken });
  assertOk('GET /support/cards/search', cards);
  printCheck('/support/cards/search returned data');
}

async function sendOrderPaidWebhook() {
  if (args['send-order-paid'] !== 'true') return;
  if (!webhookSecret) {
    throw new Error('--send-order-paid requires --webhook-secret or BOKMOO_JIFFOO_WEBHOOK_SECRET');
  }
  if (!args['order-id'] || !args['webhook-user-id']) {
    throw new Error('--send-order-paid requires --order-id and --webhook-user-id');
  }

  const body = {
    event: 'order.paid',
    eventId: `evt_bokmoo_smoke_${Date.now()}`,
    orderId: args['order-id'],
    userId: args['webhook-user-id'],
    order: {
      id: args['order-id'],
      userId: args['webhook-user-id'],
      items: [
        {
          id: `item_bokmoo_smoke_${Date.now()}`,
          productId: args['product-id'],
          variantId: args['variant-id'],
          quantity: 1,
        },
      ],
    },
  };
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${JSON.stringify(body)}`)
    .digest('hex');

  const response = await fetch(`${baseUrl}/webhooks/jiffoo/order-paid`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-jiffoo-timestamp': timestamp,
      'x-jiffoo-signature': `sha256=${signature}`,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`signed order-paid webhook failed with HTTP ${response.status}: ${messageFrom(payload)}`);
  }
  printCheck(`signed /webhooks/jiffoo/order-paid accepted (${payloadData(payload)?.status || 'received'})`);
}

async function main() {
  console.log(`smoke: BOKMOO App API base ${baseUrl}`);
  await checkPublicProducts();
  await checkAuthRoutePresence();
  await checkPaymentWebhookAlias();
  await checkUserApi();
  await checkSupportApi();
  await sendOrderPaidWebhook();
  console.log('smoke: BOKMOO App API checks passed');
}

main().catch((error) => {
  console.error(`smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

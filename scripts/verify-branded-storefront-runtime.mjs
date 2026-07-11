#!/usr/bin/env node

import { chromium } from 'playwright';

const DEFAULT_LOCALE = 'en';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_FORBIDDEN_AUTH_TEXT = [
  'Jiffoo Mall',
  'Jiffoo Store',
  'Powered by Jiffoo',
];
const DEFAULT_FORBIDDEN_PRODUCTS_TEXT = [
  'Theme Load Failed',
  'Theme Component Unavailable',
  'Unable to load products page component',
  'Theme package must provide Header and Footer components',
];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      if (args[key]) {
        args[key] = Array.isArray(args[key]) ? [...args[key], 'true'] : [args[key], 'true'];
      } else {
        args[key] = 'true';
      }
      continue;
    }

    if (args[key]) {
      args[key] = Array.isArray(args[key]) ? [...args[key], next] : [args[key], next];
    } else {
      args[key] = next;
    }
    index += 1;
  }
  return args;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/verify-branded-storefront-runtime.mjs \\
    --base-url https://girlsfind.vip \\
    --theme-slug modelsfind \\
    --theme-version 0.1.4

Options:
  --base-url            Branded storefront origin to verify.
  --theme-slug          Expected active official theme slug.
  --theme-version       Expected active official theme version.
  --locale              Locale path segment, default: ${DEFAULT_LOCALE}
  --runtime-path        Runtime-rendered page to verify. May repeat or use comma-separated values.
                        Default: --products-path or /<locale>/products
  --products-path       Products route path override. Default: /<locale>/products
  --auth-path           Auth route path override. Default: /<locale>/auth/login
  --timeout-ms          Navigation and wait timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --forbid-auth-text    Forbidden auth-page text. May repeat or use comma-separated values.
  --forbid-products-text Forbidden products-page fallback/error text. May repeat or use comma-separated values.
  --skip-auth           Skip auth route host-chrome verification.
  --headful             Run browser headful for debugging.

Checks:
  - /api/themes/active?target=shop returns the expected official-market pack slug + version.
  - /api/store/context returns the same active official-market pack slug + version.
  - Every runtime page HTML does not reference a stale or legacy theme runtime URL.
  - Every runtime page loads runtime/theme-runtime.js from .versions/<slug>/<version>.
  - Every runtime page does not load the legacy /extensions/themes/shop/<slug>/runtime path.
  - Every runtime page does not render known host fallback/error text.
  - The auth page does not contain default or supplied forbidden host chrome text.
`);
}

function fail(message) {
  throw new Error(message);
}

function firstArg(args, key, fallback = null) {
  const value = args[key];
  if (Array.isArray(value)) {
    return value[0] || fallback;
  }
  return value || fallback;
}

function normalizeBaseUrl(value) {
  if (!value || typeof value !== 'string') {
    fail('Missing --base-url.');
  }

  const parsed = new URL(value);
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/+$/, '');
}

function normalizePath(value) {
  if (!value.startsWith('/')) {
    return `/${value}`;
  }
  return value;
}

function splitList(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildUrl(baseUrl, pathname) {
  return new URL(normalizePath(pathname), `${baseUrl}/`).toString();
}

async function readPublicJson(page, path) {
  return page.evaluate(async (requestPath) => {
    const response = await fetch(requestPath, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`${requestPath} did not return JSON: ${text.slice(0, 300)}`);
    }
    if (!response.ok) {
      throw new Error(`${requestPath} returned HTTP ${response.status}: ${text.slice(0, 300)}`);
    }
    return payload;
  }, path);
}

function unwrapApiData(payload, label) {
  if (!payload || typeof payload !== 'object') {
    fail(`${label} returned an invalid payload.`);
  }
  if (payload.success === false) {
    fail(`${label} returned success=false.`);
  }
  return payload.data ?? payload;
}

function assertThemeIdentity(theme, expectedSlug, expectedVersion, label) {
  if (!theme || typeof theme !== 'object') {
    fail(`${label} did not include a theme object.`);
  }
  if (theme.slug !== expectedSlug) {
    fail(`${label} theme slug mismatch: expected ${expectedSlug}, found ${theme.slug || '<missing>'}.`);
  }
  if (theme.version !== expectedVersion) {
    fail(`${label} theme version mismatch: expected ${expectedVersion}, found ${theme.version || '<missing>'}.`);
  }
  if (theme.source !== 'official-market') {
    fail(`${label} theme source mismatch: expected official-market, found ${theme.source || '<missing>'}.`);
  }
  if (theme.type !== 'pack') {
    fail(`${label} theme type mismatch: expected pack, found ${theme.type || '<missing>'}.`);
  }
}

function assertSameThemeIdentity(left, right, leftLabel, rightLabel) {
  for (const key of ['slug', 'version', 'source', 'type']) {
    if (left?.[key] !== right?.[key]) {
      fail(`${leftLabel} and ${rightLabel} theme ${key} drift: ${left?.[key] || '<missing>'} vs ${right?.[key] || '<missing>'}.`);
    }
  }
}

async function assertActiveThemeApis(page, expectedSlug, expectedVersion) {
  const activeThemePayload = await readPublicJson(page, '/api/themes/active?target=shop');
  const activeTheme = unwrapApiData(activeThemePayload, '/api/themes/active');
  assertThemeIdentity(activeTheme, expectedSlug, expectedVersion, '/api/themes/active');

  const storeContextPayload = await readPublicJson(page, '/api/store/context');
  const storeContext = unwrapApiData(storeContextPayload, '/api/store/context');
  assertThemeIdentity(storeContext.theme, expectedSlug, expectedVersion, '/api/store/context');
  assertSameThemeIdentity(activeTheme, storeContext.theme, '/api/themes/active', '/api/store/context');

  return { activeTheme, storeContext };
}

async function collectRuntimeUrls(page) {
  return page.evaluate(() => {
    const scripts = Array.from(document.scripts).map((script) => script.src).filter(Boolean);
    const performanceScripts = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => /runtime\/theme-runtime\.js/.test(name));
    return Array.from(new Set([...scripts, ...performanceScripts]));
  });
}

async function waitForVersionedRuntime(page, expectedSlug, expectedVersion, timeoutMs) {
  const expectedPath = `/extensions/themes/shop/.versions/${expectedSlug}/${expectedVersion}/runtime/theme-runtime.js`;
  const expectedQuery = `v=${encodeURIComponent(expectedVersion)}`;
  const legacyPath = `/extensions/themes/shop/${expectedSlug}/runtime/theme-runtime.js`;

  await page.waitForFunction(
    ({ expectedPath: pathNeedle, expectedQuery: queryNeedle }) => {
      const urls = [
        ...Array.from(document.scripts).map((script) => script.src).filter(Boolean),
        ...performance.getEntriesByType('resource').map((entry) => entry.name),
      ];
      return urls.some((url) => url.includes(pathNeedle) && url.includes(queryNeedle));
    },
    { expectedPath, expectedQuery },
    { timeout: timeoutMs },
  ).catch(() => {});

  const runtimeUrls = await collectRuntimeUrls(page);
  const legacyMatches = runtimeUrls.filter((url) => url.includes(legacyPath));
  if (legacyMatches.length > 0) {
    fail(`Runtime page loaded legacy unversioned runtime path: ${legacyMatches.join(', ')}`);
  }

  const matched = runtimeUrls.filter((url) => url.includes(expectedPath) && url.includes(expectedQuery));
  if (matched.length === 0) {
    fail(`Runtime page did not load expected versioned runtime ${expectedPath}?${expectedQuery}.`);
  }

  return { expectedPath, matched, runtimeUrls };
}

async function assertRuntimeScriptResponses(page, runtimeUrls, label) {
  for (const runtimeUrl of runtimeUrls) {
    const response = await page.request.get(runtimeUrl);
    const contentType = response.headers()['content-type'] || '';
    const body = await response.text().catch(() => '');
    if (!response.ok()) {
      fail(`${label} runtime script ${runtimeUrl} returned HTTP ${response.status()}.`);
    }
    if (/text\/html/i.test(contentType)) {
      fail(`${label} runtime script ${runtimeUrl} returned HTML instead of JavaScript.`);
    }
    if (!body.includes('window.__JIFFOO_THEME_RUNTIME__')) {
      fail(`${label} runtime script ${runtimeUrl} did not expose window.__JIFFOO_THEME_RUNTIME__.`);
    }
  }
}

function getHtmlRuntimeUrls(html) {
  const urls = new Set();
  const runtimeUrlPattern = /["'=\s]([^"'\s<>]*\/extensions\/themes\/shop\/[^"'\s<>]*\/runtime\/theme-runtime\.js(?:\?[^"'\s<>]*)?)/g;
  let match = runtimeUrlPattern.exec(html);
  while (match) {
    urls.add(match[1].replace(/&amp;/g, '&'));
    match = runtimeUrlPattern.exec(html);
  }
  return Array.from(urls);
}

function assertRuntimeHtmlSource(html, expectedSlug, expectedVersion, label) {
  const expectedPath = `/extensions/themes/shop/.versions/${expectedSlug}/${expectedVersion}/runtime/theme-runtime.js`;
  const expectedQuery = `v=${encodeURIComponent(expectedVersion)}`;
  const legacyPath = `/extensions/themes/shop/${expectedSlug}/runtime/theme-runtime.js`;
  const runtimeUrls = getHtmlRuntimeUrls(html);

  const legacyMatches = runtimeUrls.filter((url) => url.includes(legacyPath));
  if (legacyMatches.length > 0) {
    fail(`${label} HTML references legacy unversioned runtime path: ${legacyMatches.join(', ')}`);
  }

  const staleMatches = runtimeUrls.filter((url) => !url.includes(expectedPath) || !url.includes(expectedQuery));
  if (staleMatches.length > 0) {
    fail(`${label} HTML references stale theme runtime URL: ${staleMatches.join(', ')}`);
  }

  return runtimeUrls;
}

async function assertAuthHostChrome(page, authUrl, forbiddenText, timeoutMs) {
  await page.goto(authUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});

  const bodyText = await page.locator('body').innerText({ timeout: timeoutMs });
  const lowerBodyText = bodyText.toLowerCase();
  const found = forbiddenText.filter((text) => lowerBodyText.includes(text.toLowerCase()));
  if (found.length > 0) {
    fail(`Auth page contains forbidden host chrome text: ${found.join(', ')}`);
  }
}

async function assertRuntimePageChrome(page, forbiddenText, timeoutMs, label) {
  const bodyText = await page.locator('body').innerText({ timeout: timeoutMs });
  const lowerBodyText = bodyText.toLowerCase();
  const found = forbiddenText.filter((text) => lowerBodyText.includes(text.toLowerCase()));
  if (found.length > 0) {
    fail(`${label} page contains forbidden host fallback text: ${found.join(', ')}`);
  }
}

function getRuntimePaths(args, productsPath) {
  const runtimePaths = splitList(
    args['runtime-path']
    || process.env.JIFFOO_RELEASE_BRANDED_RUNTIME_PATHS
    || process.env.JIFFOO_BRANDED_RUNTIME_PATHS,
  );
  return runtimePaths.length > 0 ? runtimePaths : [productsPath];
}

async function verifyRuntimePage(page, options) {
  const response = await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs });
  const html = response
    ? await response.text().catch(() => page.content())
    : await page.content();
  await page.waitForLoadState('networkidle', { timeout: options.timeoutMs }).catch(() => {});

  const htmlRuntimeUrls = assertRuntimeHtmlSource(
    html,
    options.expectedSlug,
    options.expectedVersion,
    options.label,
  );
  const runtime = await waitForVersionedRuntime(
    page,
    options.expectedSlug,
    options.expectedVersion,
    options.timeoutMs,
  );
  await assertRuntimeScriptResponses(page, runtime.matched, options.label);
  await assertRuntimePageChrome(
    page,
    options.forbiddenText,
    options.timeoutMs,
    options.label,
  );

  return {
    label: options.label,
    url: options.url,
    expectedPath: runtime.expectedPath,
    matched: runtime.matched,
    htmlReferences: htmlRuntimeUrls,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    printHelp();
    return;
  }

  const baseUrl = normalizeBaseUrl(firstArg(args, 'base-url', process.env.JIFFOO_BRANDED_STOREFRONT_URL));
  const expectedSlug = firstArg(args, 'theme-slug', process.env.JIFFOO_BRANDED_THEME_SLUG);
  const expectedVersion = firstArg(args, 'theme-version', process.env.JIFFOO_BRANDED_THEME_VERSION);
  if (!expectedSlug) fail('Missing --theme-slug.');
  if (!expectedVersion) fail('Missing --theme-version.');

  const locale = firstArg(args, 'locale', process.env.JIFFOO_BRANDED_LOCALE || DEFAULT_LOCALE);
  const timeoutMs = Number(firstArg(args, 'timeout-ms', process.env.JIFFOO_BRANDED_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS)));
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    fail(`Invalid --timeout-ms: ${timeoutMs}`);
  }

  const productsPath = firstArg(args, 'products-path', `/${locale}/products`);
  const runtimePaths = getRuntimePaths(args, productsPath);
  const authPath = firstArg(args, 'auth-path', `/${locale}/auth/login`);
  const runtimeUrls = runtimePaths.map((runtimePath) => ({
    path: runtimePath,
    url: buildUrl(baseUrl, runtimePath),
    label: runtimePath === productsPath ? 'Products' : `Runtime page ${normalizePath(runtimePath)}`,
  }));
  const productsUrl = runtimeUrls[0]?.url || buildUrl(baseUrl, productsPath);
  const authUrl = buildUrl(baseUrl, authPath);
  const forbiddenAuthText = splitList(args['forbid-auth-text']);
  const effectiveForbiddenAuthText = forbiddenAuthText.length > 0
    ? forbiddenAuthText
    : DEFAULT_FORBIDDEN_AUTH_TEXT;
  const forbiddenProductsText = splitList(args['forbid-products-text']);
  const effectiveForbiddenProductsText = forbiddenProductsText.length > 0
    ? forbiddenProductsText
    : DEFAULT_FORBIDDEN_PRODUCTS_TEXT;

  const browser = await chromium.launch({ headless: args.headful !== 'true' });
  const page = await browser.newPage({
    ignoreHTTPSErrors: args['ignore-https-errors'] === 'true',
  });
  page.setDefaultTimeout(timeoutMs);

  try {
    await page.goto(runtimeUrls[0].url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    const { activeTheme, storeContext } = await assertActiveThemeApis(page, expectedSlug, expectedVersion);
    const runtimeChecks = [];
    for (const runtimePage of runtimeUrls) {
      runtimeChecks.push(await verifyRuntimePage(page, {
        ...runtimePage,
        expectedSlug,
        expectedVersion,
        timeoutMs,
        forbiddenText: effectiveForbiddenProductsText,
      }));
    }

    if (args['skip-auth'] !== 'true') {
      await assertAuthHostChrome(page, authUrl, effectiveForbiddenAuthText, timeoutMs);
    }

    console.log(JSON.stringify({
      ok: true,
      baseUrl,
      productsUrl,
      authUrl: args['skip-auth'] === 'true' ? null : authUrl,
      expectedTheme: {
        slug: expectedSlug,
        version: expectedVersion,
      },
      activeTheme: {
        slug: activeTheme.slug,
        version: activeTheme.version,
        source: activeTheme.source ?? null,
        type: activeTheme.type ?? null,
      },
      storeContextTheme: {
        slug: storeContext.theme?.slug ?? null,
        version: storeContext.theme?.version ?? null,
        source: storeContext.theme?.source ?? null,
        type: storeContext.theme?.type ?? null,
      },
      runtime: {
        expectedPath: runtimeChecks[0]?.expectedPath || null,
        matched: runtimeChecks[0]?.matched || [],
        htmlReferences: runtimeChecks[0]?.htmlReferences || [],
      },
      runtimePages: runtimeChecks,
      verifiedProductsRuntimeChrome: true,
      verifiedAuthHostChrome: args['skip-auth'] !== 'true',
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

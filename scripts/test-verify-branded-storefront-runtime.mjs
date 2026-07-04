#!/usr/bin/env node

import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'verify-branded-storefront-runtime.mjs');
const EXPECTED_SLUG = 'modelsfind';
const EXPECTED_VERSION = '0.1.4';

function json(body) {
  return `${JSON.stringify(body, null, 2)}\n`;
}

async function startServer(options = {}) {
  const activeTheme = {
    slug: options.activeSlug || EXPECTED_SLUG,
    version: options.activeVersion || EXPECTED_VERSION,
    source: options.activeSource || 'official-market',
    type: options.activeType || 'pack',
    config: {},
    activatedAt: '2026-06-02T00:00:00.000Z',
  };
  const storeContextTheme = {
    ...activeTheme,
    ...(options.storeContextTheme || {}),
  };
  const runtimePath = options.runtimePath || `/extensions/themes/shop/.versions/${EXPECTED_SLUG}/${EXPECTED_VERSION}/runtime/theme-runtime.js?v=${EXPECTED_VERSION}`;
  const homeRuntimePath = options.homeRuntimePath || runtimePath;
  const homeBody = options.homeBody || '<main><h1>ModelsFind home</h1></main>';
  const productsBody = options.productsBody || '<main><h1>ModelsFind products</h1></main>';
  const authBody = options.authBody || '<main><h1>ModelsFind sign in</h1><p>Theme-owned auth shell</p></main>';

  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');

    if (url.pathname === '/api/themes/active') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(json({ success: true, data: activeTheme }));
      return;
    }

    if (url.pathname === '/api/store/context') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(json({
        success: true,
        data: {
          storeId: 'store_1',
          storeName: 'ModelsFind',
          theme: storeContextTheme,
          settings: {},
          status: 'active',
          currency: 'USD',
          defaultLocale: 'en',
          supportedLocales: ['en'],
        },
      }));
      return;
    }

    if (url.pathname === '/en' || url.pathname === '/en/') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(`<!doctype html>
<html>
  <head><title>ModelsFind home</title></head>
  <body>
    ${homeBody}
    <script src="${homeRuntimePath}"></script>
  </body>
</html>`);
      return;
    }

    if (url.pathname === '/en/products') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(`<!doctype html>
<html>
  <head><title>ModelsFind products</title></head>
  <body>
    ${productsBody}
    <script src="${runtimePath}"></script>
  </body>
</html>`);
      return;
    }

    if (url.pathname === '/en/auth/login') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(`<!doctype html>
<html>
  <head><title>ModelsFind login</title></head>
  <body>${authBody}</body>
</html>`);
      return;
    }

    if (/\/runtime\/theme-runtime\.js$/.test(url.pathname)) {
      response.writeHead(options.runtimeStatus || 200, {
        'content-type': options.runtimeContentType || 'application/javascript',
      });
      response.end(options.runtimeBody || 'window.__JIFFOO_THEME_RUNTIME__ = { components: {} };\n');
      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start fake branded storefront server.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

function runVerifier(baseUrl, extraArgs = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      SCRIPT,
      '--base-url',
      baseUrl,
      '--theme-slug',
      EXPECTED_SLUG,
      '--theme-version',
      EXPECTED_VERSION,
      '--timeout-ms',
      '10000',
      ...extraArgs,
    ], {
      cwd: ROOT,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      stderr += error instanceof Error ? error.message : String(error);
    });
    child.on('close', (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

function assertStatus(result, expectedStatus, label, expectedOutput = null) {
  if (result.status !== expectedStatus) {
    throw new Error(
      `${label}: expected exit ${expectedStatus}, got ${result.status ?? '<signal>'}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }

  const combined = `${result.stdout}\n${result.stderr}`;
  if (expectedOutput && !combined.includes(expectedOutput)) {
    throw new Error(`${label}: missing expected output "${expectedOutput}"\n${combined}`);
  }
}

async function withServer(options, fn) {
  const server = await startServer(options);
  try {
    return await fn(server.baseUrl);
  } finally {
    await server.close();
  }
}

async function main() {
  await withServer({}, async (baseUrl) => {
    assertStatus(await runVerifier(baseUrl), 0, 'matching branded storefront passes', '"ok": true');
  });

  await withServer({ activeVersion: '0.1.3' }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'active theme version mismatch fails',
      '/api/themes/active theme version mismatch',
    );
  });

  await withServer({ activeSource: 'builtin' }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'active theme source mismatch fails',
      '/api/themes/active theme source mismatch',
    );
  });

  await withServer({
    storeContextTheme: {
      source: 'builtin',
    },
  }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'store context source drift fails',
      '/api/store/context theme source mismatch',
    );
  });

  await withServer({
    storeContextTheme: {
      version: '0.1.3',
    },
  }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'store context version drift fails',
      '/api/store/context theme version mismatch',
    );
  });

  await withServer({
    runtimePath: `/extensions/themes/shop/${EXPECTED_SLUG}/runtime/theme-runtime.js?v=${EXPECTED_VERSION}`,
  }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'legacy unversioned runtime path fails',
      'Products HTML references legacy unversioned runtime path',
    );
  });

  await withServer({
    runtimePath: `/extensions/themes/shop/.versions/${EXPECTED_SLUG}/0.1.3/runtime/theme-runtime.js?v=0.1.3`,
  }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'stale products HTML runtime version fails',
      'Products HTML references stale theme runtime URL',
    );
  });

  await withServer({
    runtimeStatus: 404,
    runtimeBody: 'not found\n',
  }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'missing versioned runtime script fails',
      'runtime script',
    );
  });

  await withServer({
    runtimeBody: 'console.log("host fallback bundle");\n',
  }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'runtime script without theme global fails',
      'did not expose window.__JIFFOO_THEME_RUNTIME__',
    );
  });

  await withServer({
    runtimeContentType: 'text/html',
    runtimeBody: '<!doctype html><title>wrong runtime response</title>',
  }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'runtime script HTML response fails',
      'returned HTML instead of JavaScript',
    );
  });

  await withServer({
    homeRuntimePath: `/extensions/themes/shop/.versions/${EXPECTED_SLUG}/0.1.3/runtime/theme-runtime.js?v=0.1.3`,
  }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl, ['--runtime-path', '/en', '--runtime-path', '/en/products']),
      1,
      'stale extra runtime path HTML version fails',
      'Runtime page /en HTML references stale theme runtime URL',
    );
  });

  await withServer({
    productsBody: '<main><h1>Theme Load Failed</h1><p>Host fallback rendered after script load.</p></main>',
  }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'products host fallback text fails',
      'Products page contains forbidden host fallback text',
    );
  });

  await withServer({
    authBody: '<main><h1>Jiffoo Mall login</h1><p>Host auth chrome leaked.</p></main>',
  }, async (baseUrl) => {
    assertStatus(
      await runVerifier(baseUrl),
      1,
      'auth host chrome leak fails',
      'Auth page contains forbidden host chrome text',
    );
  });

  console.log('Branded storefront runtime verifier regression tests passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

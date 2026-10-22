import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { pageManifest } from '../apps/api/tests/fixtures/plugin-pages';
import { issuePublisherCertificate } from '../packages/shared/src/plugin-signing';
import { testPublisher, testRoot } from '../apps/api/tests/fixtures/plugin-signing-keys';

/** A real SDK-packed, signed Vite build; its ordinary gateway route hosts only this fixture. */
export async function pluginPagePackage(slug: string, shellProof = false) {
  const require = createRequire(path.resolve('package.json'));
  const sdk = createRequire(path.resolve('packages/plugin-sdk/package.json')).resolve('@jiffoo-core/plugin-sdk/cli');
  const { build } = await import(pathToFileURL(require.resolve('vite')).href);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-page-proof-'));
  const frontend = path.join(directory, 'frontend'), packaged = path.join(directory, 'package');
  const signed = path.join(directory, 'signed.zip');
  function command(args: string[]) {
    const result = spawnSync(process.execPath, [sdk, ...args], { env: process.env, encoding: 'utf8', windowsHide: true, timeout: 60_000 });
    if (result.status !== 0) throw new Error(`Page fixture SDK failed: ${result.stdout}${result.stderr}`);
  }
  try {
    const manifest = pageManifest(slug);
    delete manifest.services; delete manifest.serviceDependencies; delete manifest.tasks;
    manifest.ui!.adminPages = [];
    manifest.ui!.storefrontPages[0].requiresLogin = false;
    if (shellProof) {
      manifest.ui!.storefrontPages[0].placements = ['header-nav', 'account-menu', 'footer'];
      manifest.ui!.adminPages = [{ id: 'reports', path: '/reports', entry: 'index.html', title: { en: 'Reports', 'zh-Hans': '报表', 'zh-Hant': '報表' } }];
      manifest.contracts = [{ name: 'payment', version: 2 }];
      manifest.category = 'payment';
      const migration = 'CREATE TABLE bridge_payments ("requestKey" TEXT PRIMARY KEY, "sessionId" TEXT NOT NULL UNIQUE, "returnUrl" TEXT NOT NULL, fact JSONB NOT NULL);\n';
      manifest.database = { apiVersion: 1, migrations: [{ id: 'bridge-payments', order: 1,
        path: 'migrations/001-payments.sql', sha256: createHash('sha256').update(migration).digest('hex') }] };
      await fs.mkdir(path.join(packaged, 'migrations'), { recursive: true });
      await fs.writeFile(path.join(packaged, 'migrations/001-payments.sql'), migration);
    }
    await fs.mkdir(frontend, { recursive: true });
    await fs.mkdir(path.join(packaged, 'server'), { recursive: true });
    await fs.writeFile(path.join(frontend, 'index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Opaque plugin proof</title></head><body><div id="root"></div><script type="module" src="./main.js"></script></body></html>');
    await fs.copyFile('apps/admin/app/fonts/outfit-latin-400-normal.woff2', path.join(frontend, 'proof.woff2'));
    await fs.writeFile(path.join(frontend, 'style.css'), '@font-face { font-family: "P2 Outfit"; src: url("./proof.woff2") format("woff2"); font-weight: 400; } body { font-family: "P2 Outfit", monospace; font-size: 18px; }');
    await fs.writeFile(path.join(frontend, 'chunk.js'), 'export default "Dynamic import rendered";');
    // Deliberately invalid signature: exercise the default rejecting P-3 verifier, not Core auth.
    const rejectedPluginToken = [
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'plugin-page-v1' })).toString('base64url'),
      Buffer.from(JSON.stringify({ aud: 'jiffoo-plugin-gateway' })).toString('base64url'),
      'invalid',
    ].join('.');
    await fs.writeFile(path.join(frontend, 'main.js'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
const chunk = await import('./chunk.js');
await document.fonts.load('18px "P2 Outfit"');
const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
context.font = '18px monospace'; const fallback = context.measureText('Module proof WWW iii').width;
context.font = '18px "P2 Outfit", monospace';
const fontRendered = document.fonts.check('18px "P2 Outfit"') && context.measureText('Module proof WWW iii').width !== fallback;
let opaque = window.origin === 'null';
try { window.localStorage.getItem('proof'); opaque = false; } catch {}
function Proof() {
  const [gateway, setGateway] = React.useState('Form ready');
  const [submission, setSubmission] = React.useState('Submission ready');
  const [evidence, setEvidence] = React.useState({ missing: 'pending', 'plugin-page': 'pending' });
  const record = (credential, value) => setEvidence(previous => Object.assign({}, previous, { [credential]: value }));
  React.useEffect(() => {
    const blocked = event => { if (event.violatedDirective === 'form-action') setSubmission('Real submission blocked'); };
    document.addEventListener('securitypolicyviolation', blocked);
    return () => document.removeEventListener('securitypolicyviolation', blocked);
  }, []);
  return React.createElement('main', null,
    React.createElement('h1', null, 'Vite module rendered'),
    React.createElement('p', null, chunk.default),
    React.createElement('p', null, fontRendered ? 'Bundled font rendered' : 'Font failed'),
    React.createElement('p', null, opaque ? 'Opaque origin verified' : 'Origin failed'),
    React.createElement('form', { onSubmit: async event => {
      event.preventDefault();
      for (const credential of ['missing', 'plugin-page']) {
        const headers = { 'Content-Type': 'text/plain' };
        if (credential === 'plugin-page') headers.Authorization = 'Bearer ' + ${JSON.stringify(rejectedPluginToken)};
        let outcome;
        try {
          const response = await fetch('/api/v1/extensions/plugin/${slug}/api/check?credential=' + credential, { method: 'POST', credentials: 'omit', headers, body: 'proof' });
          let text;
          try { text = await response.text(); }
          catch (error) { outcome = 'body unreadable: ' + (error && error.message ? error.message : 'unknown error'); }
          if (outcome === undefined) {
            let parsed = null;
            try { parsed = JSON.parse(text); } catch (error) { parsed = null; }
            const code = parsed && parsed.error ? parsed.error.code : null;
            outcome = response.status === 401 && code === 'INVALID_TOKEN'
              ? '401 ' + code + ' ' + text
              : 'unexpected status ' + response.status + ' body ' + text.slice(0, 200);
          }
        } catch (error) {
          outcome = 'request failed: ' + (error && error.message ? error.message : 'unknown error');
        }
        record(credential, outcome);
      }
      setGateway('Gateway attempts finished');
    } }, React.createElement('button', { type: 'submit' }, 'Run React submit handler')),
    React.createElement('p', { role: 'status', 'aria-label': 'Gateway proof' }, gateway),
    React.createElement('p', { role: 'status', 'aria-label': 'Gateway credential missing' }, evidence.missing),
    React.createElement('p', { role: 'status', 'aria-label': 'Gateway credential plugin-page' }, evidence['plugin-page']),
    React.createElement('form', { action: '/must-not-submit', method: 'GET' }, React.createElement('button', { type: 'submit' }, 'Attempt real submission')),
    React.createElement('p', { role: 'status', 'aria-label': 'Submission proof' }, submission));
}
createRoot(document.getElementById('root')).render(React.createElement(Proof));
`);
    if (shellProof) await fs.writeFile(path.join(frontend, 'main.js'), `
import { createPluginBridge } from '@jiffoo/plugin-bridge';
const bridge = createPluginBridge();
const main = document.createElement('main');
const title = document.createElement('h1'); title.textContent = 'Bridge page ready'; main.append(title);
const identity = document.createElement('p'); identity.setAttribute('role', 'status'); identity.setAttribute('aria-label', 'Page identity'); main.append(identity);
const result = document.createElement('p'); result.setAttribute('role', 'status'); result.setAttribute('aria-label', 'Action result'); main.append(result);
function button(name, action) {
  const control = document.createElement('button'); control.type = 'button'; control.textContent = name;
  control.addEventListener('click', async () => { try { result.textContent = await action(); } catch { result.textContent = 'Action refused'; } });
  main.append(control);
}
await bridge.ready;
function show(context) { identity.textContent = context.customer?.email ?? context.admin?.email ?? 'Guest'; }
show(await bridge.context()); await bridge.subscribe(show);
button('Refresh scoped token', async () => { await bridge.refreshToken(); return 'Token refreshed'; });
button('Call plugin gateway', async () => {
  const response = await fetch('/api/v1/extensions/plugin/${slug}/api/check', { method: 'POST', credentials: 'omit', headers: { Authorization: 'Bearer ' + await bridge.token() } });
  return response.ok ? 'Gateway admitted' : 'Gateway refused';
});
button('Attempt Core API', async () => {
  const response = await fetch('/api/v1/account/profile', { credentials: 'omit', headers: { Authorization: 'Bearer ' + await bridge.token() } });
  return response.status === 403 ? 'Core API refused' : 'Core API unexpectedly admitted';
});
button('Unsafe navigation', async () => { await bridge.request('navigate', { path: '//evil.example' }); return 'Unexpected navigation'; });
button('Request file', async () => { await bridge.request('file.download', { reference: 'file-reference' }); return 'Prompt requested'; });
button('Resize page', async () => { await bridge.request('frame.resize', { height: 800 }); return 'Page resized'; });
const variantLabel = document.createElement('label'); variantLabel.textContent = 'Variant ID';
const variantInput = document.createElement('input'); variantLabel.append(variantInput); main.append(variantLabel);
button('Add selected variant', async () => { await bridge.request('cart.add', { variantId: variantInput.value, quantity: 1 }); return 'Product added'; });
button('Open Core checkout', async () => { await bridge.request('checkout.open'); return 'Checkout opened'; });
const reload = document.createElement('a'); reload.textContent = 'Reload plugin document'; reload.href = location.href; main.append(reload);
document.body.append(main);
`);
    await build({ configFile: false, root: frontend, base: './', logLevel: 'warn',
      resolve: { alias: { '@jiffoo/plugin-bridge': path.resolve('packages/plugin-bridge/src/index.ts'), 'react-dom/client': require.resolve('react-dom/client'), react: require.resolve('react') } },
      build: { target: 'esnext', outDir: path.join(packaged, 'ui'), assetsInlineLimit: 0, sourcemap: false, emptyOutDir: true },
    });
    await fs.writeFile(path.join(packaged, 'manifest.json'), JSON.stringify(manifest));
    await fs.writeFile(path.join(packaged, 'server/index.js'), `module.exports = { register(ctx) {
      let checkExecutions = 0;
      ${shellProof ? `
      const account = { namespace: '${slug}', merchantAccount: 'bridge-test', environment: 'test' };
      ctx.contracts.implement('payment', 2, {
        describe: input => ({displayName:'E2E Bridge Redirect',requiresManualConfirmation:false,unpaidTimeoutMinutes:120,supportedCurrencies:[input.storeCurrency],account}),
        createSession: async input => {
          const sessionId = require('node:crypto').randomUUID();
          const fact = {account,requestKey:input.idempotencyKey,sessionId,amountMinor:input.amountMinor,currency:input.currency,
            observedAt:new Date().toISOString(),status:'pending',captures:[],canStillBeCharged:true,requestClosed:false,
            action:{type:'redirect',url:'http://127.0.0.1:3001/api/v1/extensions/plugin/${slug}/api/pay/' + sessionId}};
          await ctx.database.query('INSERT INTO bridge_payments ("requestKey","sessionId","returnUrl",fact) VALUES($1,$2,$3,$4) ON CONFLICT ("requestKey") DO NOTHING',[input.idempotencyKey,sessionId,input.returnUrl,fact]);
          return (await ctx.database.query('SELECT fact FROM bridge_payments WHERE "requestKey"=$1',[input.idempotencyKey])).rows[0].fact;
        },
        queryByRequestKey: async input => {
          const row = (await ctx.database.query('SELECT fact FROM bridge_payments WHERE "requestKey"=$1',[input.requestKey])).rows[0];
          if (!row) throw new Error('Unknown provider request');
          return row.fact;
        }
      });
      ctx.http.route({method:'GET',path:'/pay/:id',handler:async (request,reply) => {
        const row = (await ctx.database.query('SELECT fact,"returnUrl" FROM bridge_payments WHERE "sessionId"=$1',[request.params.id])).rows[0];
        if (!row) return reply.code(404).send();
        reply.header('Content-Security-Policy', "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' " + new URL(row.returnUrl).origin);
        return reply.type('text/html').send('<!doctype html><html lang="en"><title>Local payment provider</title><h1>Local payment provider</h1><form method="post" enctype="text/plain"><button type="submit">Confirm provider payment</button></form></html>');
      }});
      ctx.http.route({method:'POST',path:'/pay/:id',handler:async (request,reply) => {
        const row = (await ctx.database.query('SELECT fact,"returnUrl" FROM bridge_payments WHERE "sessionId"=$1',[request.params.id])).rows[0];
        if (!row) return reply.code(404).send();
        const fact = row.fact;
        fact.status = 'succeeded'; fact.canStillBeCharged = false; fact.requestClosed = true;
        if (!fact.captures.length) fact.captures.push({account,requestKey:fact.requestKey,sessionId:fact.sessionId,providerPaymentId:fact.sessionId,amountMinor:fact.amountMinor,currency:fact.currency,observedAt:new Date().toISOString()});
        await ctx.database.query('UPDATE bridge_payments SET fact=$2 WHERE "sessionId"=$1',[request.params.id,fact]);
        return reply.redirect(row.returnUrl);
      }});
      ` : ''}
      ctx.http.route({ method: 'GET', path: '/proof-host', handler: (request, reply) => {
        const hash = request.query.hash;
        if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) return reply.code(400).send({ error: 'Invalid hash' });
        const origin = request.query.surface === 'shop' ? 'http://127.0.0.1:3003' : 'http://127.0.0.1:3002';
        return reply.type('text/html').header('Content-Security-Policy', "default-src 'none'; frame-src " + origin).send(
          '<!doctype html><html lang="en"><title>Plugin asset proof host</title><h1>Plugin asset proof host</h1><iframe role="document" aria-label="Plugin asset proof" title="Plugin asset proof" width="900" height="600" sandbox="allow-scripts allow-forms" src="/api/v1/plugin-assets/' + ctx.plugin.installationId + '/' + hash + '/index.html"></iframe></html>');
      } });
      ctx.http.route({ method: 'GET', path: '/proof-executions', handler: () => ({ executions: checkExecutions }) });
      ctx.http.route({ method: 'POST', path: '/check', handler: () => ({ executed: true, executions: ++checkExecutions }) });
    } };`);
    const certificate = path.join(directory, 'certificate.json'), key = path.join(directory, 'publisher.pem');
    await fs.writeFile(certificate, JSON.stringify(issuePublisherCertificate('page-proof-publisher', 'Page proof publisher', testPublisher.publicKey, testRoot.privateKey)));
    await fs.writeFile(key, testPublisher.privateKey);
    command(['pack', '--input', packaged, '--output', path.join(directory, 'unsigned.zip')]);
    command(['sign', '--input', path.join(directory, 'unsigned.zip'), '--certificate', certificate, '--key', key, '--output', signed]);
    return { bytes: await fs.readFile(signed), cleanup: () => fs.rm(directory, { recursive: true, force: true }) };
  } catch (error) { await fs.rm(directory, { recursive: true, force: true }); throw error; }
}

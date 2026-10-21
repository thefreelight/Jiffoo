import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { pageManifest } from '../apps/api/tests/fixtures/plugin-pages';
import { issuePublisherCertificate } from '../packages/shared/src/plugin-signing';
import { testPublisher, testRoot } from '../apps/api/tests/fixtures/plugin-signing-keys';

/** A real SDK-packed, signed Vite build; its ordinary gateway route hosts only this fixture. */
export async function pluginPagePackage(slug: string) {
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
    await build({ configFile: false, root: frontend, base: './', logLevel: 'warn',
      resolve: { alias: { 'react-dom/client': require.resolve('react-dom/client'), react: require.resolve('react') } },
      build: { target: 'esnext', outDir: path.join(packaged, 'ui'), assetsInlineLimit: 0, sourcemap: false, emptyOutDir: true },
    });
    await fs.writeFile(path.join(packaged, 'manifest.json'), JSON.stringify(manifest));
    await fs.writeFile(path.join(packaged, 'server/index.js'), `module.exports = { register(ctx) {
      let checkExecutions = 0;
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

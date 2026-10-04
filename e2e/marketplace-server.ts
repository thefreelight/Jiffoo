import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { issuePublisherCertificate } from '../packages/shared/src/plugin-signing';
import { testPublisher, testRoot } from '../apps/api/tests/fixtures/plugin-signing-keys';

async function main() {
const root = process.cwd();
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-e2e-marketplace-'));
const sdk = path.resolve(root, 'packages/plugin-sdk/dist/cli.js');
const packages = new Map<string, Buffer>();
const publisherId = 'e2e-marketplace-publisher';
const certificate = path.join(temporary, 'certificate.json');
const key = path.join(temporary, 'publisher.pem');

function command(args: string[]) {
  const result = spawnSync(process.execPath, [sdk, ...args], { env: process.env, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`SDK ${args[0]} failed: ${result.stdout}${result.stderr}`);
}

async function packageVersion(slug: string, name: string, version: string, minApiVersion = 'v1', fixture = 'apps/api/builtin-plugins/free-shipping') {
  const source = path.join(temporary, `${slug}-${version}`);
  await fs.cp(path.resolve(root, fixture), source, { recursive: true });
  const manifestPath = path.join(source, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  Object.assign(manifest, { slug, name, version, minApiVersion });
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  const unsigned = path.join(temporary, `${slug}-${version}-unsigned.zip`);
  const signed = path.join(temporary, `${slug}-${version}.zip`);
  command(['pack', '--input', source, '--output', unsigned]);
  command(['sign', '--input', unsigned, '--certificate', certificate, '--key', key, '--output', signed]);
  const bytes = await fs.readFile(signed);
  const downloadUrl = `/packages/${slug}-${version}.zip`;
  packages.set(downloadUrl, bytes);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  console.log(`${slug} ${version}: ${bytes.length} bytes sha256=${sha256}`);
  return { version, minApiVersion, downloadUrl, size: bytes.length, sha256 };
}

try {
  await fs.writeFile(certificate, JSON.stringify(issuePublisherCertificate(publisherId, 'E2E Publisher', testPublisher.publicKey, testRoot.privateKey)));
  await fs.writeFile(key, testPublisher.privateKey, { mode: 0o600 });
  const compatible = {
    id: 'e2e-market-shipping', slug: 'e2e-market-shipping', name: 'E2E Marketplace Shipping',
    description: 'Local signed shipping fixture for install and update.', publisherId,
    declaredCapabilities: ['shipping'],
    versions: [
      await packageVersion('e2e-market-shipping', 'E2E Marketplace Shipping', '1.0.0'),
      await packageVersion('e2e-market-shipping', 'E2E Marketplace Shipping', '2.0.0'),
      await packageVersion('e2e-market-shipping', 'E2E Marketplace Shipping', '3.0.0', 'v99'),
    ],
  };
  const brokenVersion = await packageVersion('e2e-market-broken', 'E2E Broken Package', '1.0.0');
  // Preserve the catalog's real digest and size, but serve changed bytes to exercise verification.
  const corrupt = Buffer.from(packages.get(brokenVersion.downloadUrl)!);
  corrupt[corrupt.length - 1] ^= 1;
  packages.set(brokenVersion.downloadUrl, corrupt);
  const payment = {
    id: 'e2e-callback-payment', slug: 'e2e-callback-payment', name: 'E2E Callback Payment',
    description: 'Local PSP with field-based callback HMAC.', publisherId,
    declaredCapabilities: ['payment'],
    versions: [await packageVersion('e2e-callback-payment', 'E2E Callback Payment', '1.0.0', 'v1', 'e2e/fixtures/callback-payment')],
  };
  const catalog = JSON.stringify({ schemaVersion: 1, plugins: [compatible, payment, {
    id: 'e2e-market-broken', slug: 'e2e-market-broken', name: 'E2E Broken Package',
    description: 'The served bytes deliberately fail the catalog digest check.', publisherId,
    declaredCapabilities: ['shipping'], versions: [brokenVersion],
  }] });
  const server = createServer((request, response) => {
    if (request.method !== 'GET') { response.writeHead(405).end(); return; }
    if (request.url === '/health') { response.writeHead(200).end('ready'); return; }
    if (request.url === '/catalog') {
      response.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(catalog) }).end(catalog);
      return;
    }
    const bytes = packages.get(request.url ?? '');
    if (!bytes) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'content-type': 'application/zip', 'content-length': bytes.length }).end(bytes);
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
    server.closeAllConnections();
    server.close(() => { void fs.rm(temporary, { recursive: true, force: true }).then(() => process.exit(0)); });
  });
  server.listen(3010, '127.0.0.1', () => console.log('Local marketplace ready at http://127.0.0.1:3010/catalog'));
} catch (error) {
  await fs.rm(temporary, { recursive: true, force: true });
  throw error;
}
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });

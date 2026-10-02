import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPublicKey, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';
import { getTestPrisma } from '../helpers/db';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { clearTestPluginCache } from '../helpers/plugin-cache';
import { issuePublisherCertificate, readPluginZipEntries } from 'shared/plugin-signing';
import { otherPublisher, testRoot, testPublisher, untrustedRoot } from '../fixtures/plugin-signing-keys';

const cli = path.resolve('../../packages/plugin-sdk/dist/cli.js');
const ownerTool = path.resolve('../../tools/owner/issue-publisher-cert.mjs');
const prisma = getTestPrisma();
const slug = () => `sdk-${randomUUID().slice(0, 12)}`;
const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

async function directory() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'jiffoo-sdk-'));
}
async function plugin(root: string, id = slug(), extra: Record<string, unknown> = {}) {
  await fs.mkdir(path.join(root, 'dist'), { recursive: true });
  await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({
    schemaVersion: 1, slug: id, name: 'SDK Test Plugin', version: '1.0.0',
    description: 'SDK integration', author: 'Test', category: 'integration',
    runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1',
    entryModule: 'dist/index.js', permissions: [], contracts: [], ...extra,
  }));
  await fs.writeFile(path.join(root, 'dist/index.js'), 'module.exports = { register(ctx) { ctx.http.route({ method: "GET", path: "/health", handler: async () => ({ ok: true }) }); } };');
  return id;
}

describe('Built plugin SDK CLI', () => {
  let app: FastifyInstance;
  let base: string;
  let token: string;
  const installed = new Set<string>();
  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: false });
    token = (await createAdminWithToken()).token;
    base = await app.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(async () => {
    for (const id of installed) {
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: id } });
      await prisma.pluginInstall.deleteMany({ where: { slug: id } });
      await clearTestPluginCache(id);
    }
    await deleteAllTestUsers();
    await app.close();
  });

  it('Q keygen writes a PKCS8 PEM, prints only the public key, and refuses overwrite', async () => {
    const dir = await directory();
    try {
      const output = path.join(dir, 'publisher.pem');
      const generated = run('keygen', '--out', output);
      expect(generated.status).toBe(0);
      expect(generated.stderr).toBe('');
      const pem = await fs.readFile(output, 'utf8');
      expect(pem).toMatch(/^-----BEGIN PRIVATE KEY-----/);
      expect(generated.stdout.trim()).toBe(createPublicKey(pem).export({ format: 'der', type: 'spki' }).toString('base64url'));
      expect(generated.stdout).not.toContain('PRIVATE KEY');
      expect(run('keygen', '--out', output)).toMatchObject({ status: 1 });
      expect(await fs.readFile(output, 'utf8')).toBe(pem);
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
  });

  it('R pack produces identical root-layout ZIP bytes without directory entries', async () => {
    const dir = await directory();
    try {
      const input = path.join(dir, 'input'); await fs.mkdir(input);
      await plugin(input);
      const first = path.join(dir, 'first.zip'), second = path.join(dir, 'second.zip');
      const a = run('pack', '--input', input, '--output', first);
      const b = run('pack', '--input', input, '--output', second);
      expect(a.status).toBe(0); expect(b.status).toBe(0);
      expect(a.stdout.trim().split(/\r?\n/)).toEqual(['dist/index.js', 'manifest.json']);
      expect(await fs.readFile(first)).toEqual(await fs.readFile(second));
      expect(readPluginZipEntries(await fs.readFile(first)).map((entry) => entry.path)).toEqual(['dist/index.js', 'manifest.json']);
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
  });

  it.each([
    ['unknown manifest field', { unexpected: true }, null, 'UNKNOWN_MANIFEST_FIELD'],
    ['invalid config schema', { configSchema: { type: 'array', properties: {}, required: [] } }, null, 'INVALID_CONFIG_SCHEMA'],
    ['native module', {}, 'dist/addon.node', 'FORBIDDEN_NATIVE_MODULE'],
    ['signature material', {}, 'META-INF/jiffoo/marker', 'SIGNATURE_MATERIAL_PRESENT'],
  ])('S pack rejects %s with its specific error', async (_case, extra, forbidden, code) => {
    const dir = await directory();
    try {
      const input = path.join(dir, 'input'); await fs.mkdir(input);
      await plugin(input, slug(), extra);
      if (forbidden) {
        await fs.mkdir(path.dirname(path.join(input, forbidden)), { recursive: true });
        await fs.writeFile(path.join(input, forbidden), 'fixture');
      }
      const output = path.join(dir, 'output.zip');
      const result = run('pack', '--input', input, '--output', output);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(code);
      await expect(fs.access(output)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
  });

  it.each(['key mismatch', 'untrusted certificate', 'already signed'])('T sign rejects %s', async (scenario) => {
    const dir = await directory();
    try {
      const input = path.join(dir, 'input'); await fs.mkdir(input);
      await plugin(input);
      const unsigned = path.join(dir, 'unsigned.zip');
      expect(run('pack', '--input', input, '--output', unsigned).status).toBe(0);
      const certificate = path.join(dir, 'cert.json');
      const key = path.join(dir, 'publisher.pem');
      await fs.writeFile(key, scenario === 'key mismatch' ? otherPublisher.privateKey : testPublisher.privateKey);
      await fs.writeFile(certificate, JSON.stringify(issuePublisherCertificate('sdk-publisher', 'SDK Publisher', testPublisher.publicKey,
        scenario === 'untrusted certificate' ? untrustedRoot.privateKey : testRoot.privateKey)));
      let source = unsigned;
      if (scenario === 'already signed') {
        source = path.join(dir, 'signed.zip');
        expect(run('sign', '--input', unsigned, '--certificate', certificate, '--key', key, '--output', source).status).toBe(0);
      }
      const output = path.join(dir, 'rejected.zip');
      const result = run('sign', '--input', source, '--certificate', certificate, '--key', key, '--output', output);
      const code = scenario === 'key mismatch' ? 'KEY_CERTIFICATE_MISMATCH' :
        scenario === 'untrusted certificate' ? 'UNTRUSTED_PUBLISHER_CERTIFICATE' : 'SIGNATURE_MATERIAL_PRESENT';
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(code);
      await expect(fs.access(output)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
  });

  it('U keygen, owner certificate, pack, sign, and HTTP upload install a verified publisher without leaking private keys', async () => {
    const dir = await directory();
    const id = slug(); installed.add(id);
    try {
      const input = path.join(dir, 'input'); await fs.mkdir(input);
      await plugin(input, id);
      const publisherKey = path.join(dir, 'publisher.pem');
      const rootKey = path.join(dir, 'root.pem');
      const certificate = path.join(dir, 'cert.json');
      const unsigned = path.join(dir, 'unsigned.zip');
      const signed = path.join(dir, 'signed.zip');
      const generated = run('keygen', '--out', publisherKey);
      expect(generated.status).toBe(0);
      await fs.writeFile(rootKey, testRoot.privateKey);
      const issued = spawnSync(process.execPath, [
        ownerTool, '--publisher-id', 'sdk-publisher', '--name', 'SDK Publisher',
        '--public-key', generated.stdout.trim(), '--root-private-key', rootKey, '--output', certificate,
      ], { encoding: 'utf8' });
      expect(issued.status).toBe(0);
      const packed = run('pack', '--input', input, '--output', unsigned);
      expect(packed.status).toBe(0);
      const signedResult = run('sign', '--input', unsigned, '--certificate', certificate, '--key', publisherKey, '--output', signed);
      expect(signedResult.status).toBe(0);
      const pem = await fs.readFile(publisherKey, 'utf8');
      const zip = await fs.readFile(signed);
      const output = generated.stdout + generated.stderr + issued.stdout + issued.stderr + packed.stdout + packed.stderr + signedResult.stdout + signedResult.stderr;
      expect(output).not.toContain(pem);
      expect(output).not.toContain(testRoot.privateKey);
      expect(zip.includes(Buffer.from(pem))).toBe(false);
      expect(zip.includes(Buffer.from(testRoot.privateKey))).toBe(false);
      const { uploadPluginZip } = await import('../helpers/plugin-upload');
      const response = await uploadPluginZip(base, token, zip, false);
      expect(response.status).toBe(200);
      expect((await response.json()).data).toMatchObject({ publisherId: 'sdk-publisher', publisherName: 'SDK Publisher', publisherVerified: false, signingRoot: 'test' });
      expect(await prisma.pluginInstall.findUniqueOrThrow({ where: { slug: id } })).toMatchObject({ trustLevel: 'signed', signingRoot: 'test', publisherId: 'sdk-publisher' });
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
  });
});

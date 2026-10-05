import { describe, expect, it } from 'vitest';
import { createServer, connect, type Socket } from 'node:net';
import { once } from 'node:events';
import { fork, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import Redis from 'ioredis';
import { env } from '@/config/env';
import { getTestPrisma } from '../helpers/db';
import { publishTestPlugin, clearTestPluginCache } from '../helpers/plugin-cache';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { pluginProtectionScope, sharedProtection } from '@/infra/shared-protection';

function ready(child: ChildProcess): Promise<{ port: number; pid: number }> {
  return new Promise((resolve, reject) => {
    const receive = (message: any) => {
      if (message.kind === 'ready') { child.off('message', receive); resolve(message); }
      if (message.kind === 'error') { child.off('message', receive); reject(new Error(message.message)); }
    };
    child.on('message', receive);
    child.once('error', reject);
    child.once('exit', (code) => { if (code) reject(new Error(`Child exited: ${code}`)); });
  });
}

async function fixture() {
  const original = new URL(env.REDIS_URL);
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    const upstream = connect({ host: original.hostname, port: Number(original.port || 6379) });
    sockets.add(socket); sockets.add(upstream);
    for (const value of [socket, upstream]) {
      value.on('error', () => { socket.destroy(); upstream.destroy(); });
      value.on('close', () => sockets.delete(value));
    }
    socket.pipe(upstream); upstream.pipe(socket);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing relay listener');
  const port = address.port;
  const url = new URL(original); url.hostname = '127.0.0.1'; url.port = String(port);
  const namespace = `test:process:${randomUUID()}`;
  const children = [0, 1].map(() => fork(path.resolve('tests/helpers/protection-child.ts'), [url.href, namespace], {
    execArgv: ['--import', 'tsx'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'], env: { ...process.env },
  }));
  const endpoints = await Promise.all(children.map(ready));
  const request = (index: number, pathname = '/read', method = 'GET') => fetch(`http://127.0.0.1:${endpoints[index].port}${pathname}`, { method });
  const operation = (index: number, input: Record<string, unknown>): Promise<any> => new Promise((resolve, reject) => {
    const id = randomUUID(); const child = children[index];
    const receive = (message: any) => {
      if (message.id !== id) return;
      child.off('message', receive);
      if (message.error) reject(new Error(message.error)); else resolve(message.value);
    };
    child.on('message', receive); child.send({ ...input, id });
  });
  const drop = async () => {
    const closed = new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const socket of sockets) socket.destroy();
    await closed;
  };
  const recover = async () => {
    const connected = new Promise<void>((resolve) => {
      let count = 0;
      const accepted = () => { if (++count === 2) { server.off('connection', accepted); resolve(); } };
      server.on('connection', accepted);
    });
    server.listen(port, '127.0.0.1'); await once(server, 'listening');
    await connected;
  };
  const cleanup = async () => {
    const exits = children.map((child) => once(child, 'exit'));
    for (const child of children) child.send({ kind: 'stop' });
    await Promise.all(exits);
    if (server.listening) await drop();
    const client = new Redis(env.REDIS_URL);
    try { const keys = await client.keys(`${namespace}:*`); if (keys.length) await client.del(...keys); }
    finally { client.disconnect(); }
  };
  return { request, endpoints, drop, recover, cleanup, operation, namespace };
}

describe('real cross-process protection', () => {
  it('G: two real processes share one atomic Redis request limit', async () => {
    const value = await fixture();
    try {
      expect(value.endpoints[0].pid).not.toBe(value.endpoints[1].pid);
      let release!: () => void;
      const latch = new Promise<void>((resolve) => { release = resolve; });
      const requests = Array.from({ length: 20 }, async (_, index) => { await latch; return (await value.request(index % 2)).status; });
      release();
      const statuses = await Promise.all(requests);
      expect(statuses.filter((status) => status === 200)).toHaveLength(3);
      expect(statuses.filter((status) => status === 429)).toHaveLength(17);
    } finally { await value.cleanup(); }
  });
  it('H: a real Redis relay outage returns 503 in both processes and recovery preserves the bucket', async () => {
    const value = await fixture();
    try {
      for (const index of [0, 1]) expect((await value.request(index, '/api/v1/auth/login', 'POST')).status).toBe(200);
      expect((await value.request(0)).status).toBe(200);
      await value.drop();
      for (const index of [0, 1]) {
        const response = await value.request(index);
        expect(response.status).toBe(503); expect(response.headers.get('Retry-After')).toBe('5');
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect((await response.json()).error.code).toBe('SHARED_PROTECTION_UNAVAILABLE');
      }
      await value.recover();
      expect((await value.request(0)).status).toBe(200);
      expect((await value.request(1)).status).toBe(200);
      expect((await value.request(0)).status).toBe(429);
    } finally { await value.cleanup(); }
  });
  it('J: two real processes share breaker results and a single half-open probe', async () => {
    const value = await fixture(); const scope = `${value.namespace}:breaker-scope`;
    const client = new Redis(env.REDIS_URL);
    try {
      for (let i = 0; i < 10; i++) {
        const permit = await value.operation(i % 2, { kind: 'breaker', scope });
        expect(permit).not.toBeNull();
        await value.operation((i + 1) % 2, { kind: 'result', permit, success: false });
      }
      expect(await value.operation(0, { kind: 'breaker', scope })).toBeNull();
      expect(await value.operation(1, { kind: 'breaker', scope })).toBeNull();
      await client.hset(`${scope}:breaker`, 'until', '0');
      let release!: () => void;
      const latch = new Promise<void>((resolve) => { release = resolve; });
      const requests = [0, 1].map(async (index) => { await latch; return value.operation(index, { kind: 'breaker', scope }); });
      release();
      const permits = await Promise.all(requests);
      expect(permits.filter(Boolean)).toHaveLength(1);
      await value.operation(0, { kind: 'result', permit: permits.find(Boolean), success: true });
      expect(await value.operation(1, { kind: 'breaker', scope })).not.toBeNull();
    } finally { client.disconnect(); await value.cleanup(); }
  });
  it('K: lifecycle generation resets both processes and remote reload preserves the new shared quota', async () => {
    const value = await fixture(); const prisma = getTestPrisma();
    const slug = `generation-${randomUUID().slice(0, 12)}`;
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'protection-generation-'));
    const client = new Redis(env.REDIS_URL);
    let installationId: string | undefined;
    try {
      const manifest = { schemaVersion: 1, slug, name: slug, description: 'Protection generation test', version: '1.0.0', runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'server/index.js', permissions: [] };
      await fs.mkdir(path.join(directory, 'server'));
      await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
      await fs.writeFile(path.join(directory, 'server/index.js'), 'module.exports = { register() {} };');
      const zipHash = await publishTestPlugin(slug, directory);
      await prisma.pluginInstall.create({ data: { slug, name: slug, version: '1.0.0', zipHash, manifestJson: manifest, source: 'local-zip' } });
      const installation = await prisma.pluginInstallation.create({ data: { pluginSlug: slug, instanceKey: 'default', enabled: true } });
      installationId = installation.id;
      const oldScope = pluginProtectionScope(installation.id, installation.protectionGeneration);
      const delayed = await value.operation(0, { kind: 'breaker', scope: oldScope });
      expect((await value.operation(0, { kind: 'installation-rate', installationId })).allowed).toBe(true);
      expect((await value.operation(1, { kind: 'installation-rate', installationId })).allowed).toBe(false);
      await PluginManagementService.updateInstance(installationId, { enabled: false });
      await PluginManagementService.updateInstance(installationId, { enabled: true });
      const first = await value.operation(0, { kind: 'installation-rate', installationId });
      expect(first).toMatchObject({ allowed: true, generation: '2' });
      await value.operation(1, { kind: 'reload', slug });
      expect(await value.operation(1, { kind: 'installation-rate', installationId })).toMatchObject({ allowed: false, generation: '2' });
      await value.operation(0, { kind: 'result', permit: delayed, success: false });
      expect(await value.operation(1, { kind: 'breaker', scope: pluginProtectionScope(installationId, 2n) })).not.toBeNull();
    } finally {
      await value.cleanup(); sharedProtection.close();
      if (installationId) { const keys = await client.keys(`jiffoo:protection:plugin:{${installationId}:*`); if (keys.length) await client.del(...keys); }
      client.disconnect();
      await prisma.pluginInstallation.deleteMany({ where: { pluginSlug: slug } });
      await prisma.pluginInstall.deleteMany({ where: { slug } });
      await clearTestPluginCache(slug); await fs.rm(directory, { recursive: true, force: true });
    }
  });
});

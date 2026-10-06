import { fork, type ChildProcess } from 'node:child_process';
import { createServer, connect, type Socket } from 'node:net';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import Redis from 'ioredis';

export async function tcpRelay(originalUrl: string, defaultPort: number) {
  const original = new URL(originalUrl);
  const sockets = new Set<Socket>();
  let paused = false;
  let hold: { predicate: (frame: Buffer) => boolean; entered: () => void; release?: () => void } | undefined;
  const server = createServer((socket) => {
    if (paused) { socket.destroy(); return; }
    const upstream = connect({ host: original.hostname, port: Number(original.port || defaultPort) });
    for (const peer of [socket, upstream]) {
      sockets.add(peer); peer.on('close', () => sockets.delete(peer));
      peer.on('error', () => { socket.destroy(); upstream.destroy(); });
    }
    let pending = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      if (!hold) { upstream.write(chunk); return; }
      pending = Buffer.concat([pending, chunk]);
      while (pending.length) {
        const end = pending.indexOf('\r\n'); if (end < 0) return;
        const count = Number(pending.subarray(1, end).toString());
        if (pending[0] !== 42 || !Number.isSafeInteger(count)) { upstream.write(pending); pending = Buffer.alloc(0); return; }
        let position = end + 2, complete = true;
        for (let index = 0; index < count; index++) {
          const line = pending.indexOf('\r\n', position); if (line < 0) { complete = false; break; }
          const length = Number(pending.subarray(position + 1, line).toString());
          position = line + 2 + length + 2;
          if (position > pending.length) { complete = false; break; }
        }
        if (!complete) return;
        const frame = pending.subarray(0, position); pending = pending.subarray(position);
        if (hold.predicate(frame)) {
          const held = hold; held.release = () => { upstream.write(frame); if (pending.length) upstream.write(pending); pending = Buffer.alloc(0); hold = undefined; };
          held.entered(); return;
        }
        upstream.write(frame);
      }
    });
    upstream.pipe(socket);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing relay listener');
  const url = new URL(original); url.hostname = '127.0.0.1'; url.port = String(address.port);
  return {
    url: url.href,
    drop: () => { paused = true; for (const socket of sockets) socket.destroy(); },
    recover: () => { paused = false; },
    holdNext: (predicate: (frame: Buffer) => boolean) => {
      const entered = new Promise<void>((resolve) => { hold = { predicate, entered: resolve }; });
      return { entered, release: () => hold?.release?.() };
    },
    close: async () => { for (const socket of sockets) socket.destroy(); await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); },
  };
}

export async function errorHttpFixture(options: { testSigningMode?: boolean } = {}) {
  const db = await tcpRelay(process.env.DATABASE_URL_TEST!, 5432);
  const redis = await tcpRelay(process.env.REDIS_URL!, 6379);
  const ip = `198.18.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;
  const child = fork(path.resolve(__dirname, 'error-semantics-child.ts'), [], {
    cwd: path.resolve(__dirname, '../..'),
    execArgv: ['--import', 'tsx'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    env: { ...process.env, DATABASE_URL: db.url, REDIS_URL: redis.url, TRUSTED_PROXIES: '127.0.0.1,::1', DISABLE_RATE_LIMITER: 'false',
      ...(options.testSigningMode === undefined ? {} : { EXTENSION_TEST_SIGNING_MODE: String(options.testSigningMode) }) },
  });
  const observed: Array<{ name?: string; code?: string; errorCode?: string }> = [];
  child.on('message', (message: { kind?: string; name?: string; code?: string; errorCode?: string }) => { if (message.kind === 'observed-error') observed.push(message); });
  const ready = await new Promise<{ port: number }>((resolve, reject) => {
    const receive = (message: { kind: string; port: number; message: string }) => {
      if (message.kind === 'ready') { child.off('message', receive); resolve(message); }
      if (message.kind === 'failed') { child.off('message', receive); reject(new Error(message.message)); }
    };
    child.on('message', receive); child.once('error', reject); child.once('exit', (code) => { if (code) reject(new Error(`Fixture exited ${code}`)); });
  });
  const base = `http://127.0.0.1:${ready.port}`;
  const users = new Set<string>();
  const send = (input: Record<string, unknown>) => new Promise<void>((resolve) => {
    const id = randomUUID(); const receive = (message: { id?: string }) => { if (message.id === id) { child.off('message', receive); resolve(); } };
    child.on('message', receive); child.send({ ...input, id });
  });
  const request = (url: string, init: RequestInit = {}) => fetch(base + url, { ...init, headers: { 'x-forwarded-for': ip, ...Object.fromEntries(new Headers(init.headers)) } });
  return { base, child, db, redis, observed, users, send, request, ip,
    close: async () => {
      db.recover(); redis.recover();
      if (child.connected) { const exited = once(child, 'exit'); child.send({ kind: 'stop' }); await exited; }
      await db.close(); await redis.close();
      const cache = new Redis(process.env.REDIS_URL!);
      try {
        const keys = [`jiffoo:protection:rl:abuse:ip:${ip}`, `jiffoo:protection:rl:anonymous:ip:${ip}`, ...['login', 'register', 'forgot-password'].map((route) => `jiffoo:protection:rl:/api/v1/auth/${route}:ip:${ip}`), ...[...users].map((id) => `jiffoo:protection:rl:user:user:${id}`)];
        await cache.del(...keys);
      } finally { cache.disconnect(); }
    },
  };
}

import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import archiver from 'archiver';
import Redis from 'ioredis';
import { getTestPrisma } from './db';
import { createTestUser, signJwt } from './auth';

export const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
export const font = Buffer.from('wOF2theme-test');
export const localized = { en: 'Theme image', 'zh-Hans': '主题图片', 'zh-Hant': '主題圖片' };
export async function themeFiles(slug: string, target: 'shop' | 'admin' = 'shop', version = '1.0.0', image = png) {
  const manifest = JSON.parse(await fs.readFile(path.resolve('builtin-themes', `default-${target}`, 'theme.json'), 'utf8'));
  Object.assign(manifest, { slug, version, name: slug, assets: target === 'admin' ? { logo: 'assets/hero.png' } : {},
    fonts: [{ id: 'test-brand', family: 'Theme Brand', file: 'fonts/brand.woff2', weight: 400, style: 'normal', license: 'MIT' }],
    settings: [{ id: 'picture', type: 'image', label: localized, default: 'assets/hero.png', constraints: {} }] });
  return new Map([['theme.json', Buffer.from(JSON.stringify(manifest))], ['assets/hero.png', image], ['fonts/brand.woff2', font]]);
}
export async function zipTheme(files: Map<string, Buffer>): Promise<Buffer> {
  const archive = archiver('zip'), chunks: Buffer[] = [];
  const done = new Promise<void>((resolve, reject) => { archive.on('data', chunk => chunks.push(chunk)); archive.once('end', resolve); archive.once('error', reject); });
  for (const [name, bytes] of files) archive.append(bytes, { name, date: new Date('1980-01-01T00:00:00Z'), mode: 0o644, store: true });
  await archive.finalize(); await done; return Buffer.concat(chunks);
}
export type ThemeChild = { child: ChildProcess; root: string; base?: string; ip: string; messages: any[]; output: string[] };
export async function startThemeChild(role = 'http', barrier?: string, environment: Record<string, string> = {}): Promise<ThemeChild> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'b4-theme-'));
  const child = fork(path.resolve('tests/helpers/theme-package-child.ts'), [role], {
    execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL_TEST, EXTENSIONS_PATH: root,
      TRUSTED_PROXIES: '127.0.0.1,::1',
      ...(barrier ? { JIFFOO_TEST_THEME_BARRIER: barrier } : {}), ...environment },
  });
  const item: ThemeChild = { child, root, ip: `198.19.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`, messages: [], output: [] };
  child.stdout?.on('data', bytes => item.output.push(bytes.toString())); child.stderr?.on('data', bytes => item.output.push(bytes.toString()));
  try {
    const ready = await new Promise<any>((resolve, reject) => {
      child.on('message', (message: any) => { item.messages.push(message); if (message.kind === 'ready') resolve(message); if (message.kind === 'error') reject(new Error(message.message)); });
      child.once('error', reject); child.once('exit', code => reject(new Error(`Theme child exited ${code}`)));
    });
    item.base = ready.base; return item;
  } catch (error) {
    // A rejected startup has no ready runtime to stop. Sending on its closing IPC
    // channel would replace the original guard error with EPIPE.
    if (child.exitCode === null) await new Promise<void>(resolve => child.once('exit', () => resolve()));
    await fs.rm(root, { recursive: true, force: true }); throw new Error(`${String(error)}\n${item.output.join('')}`);
  }
}
export async function stopThemeChild(item: ThemeChild): Promise<void> {
  if (item.child.connected) {
    for (const message of item.messages.filter(message => message.kind === 'theme-barrier')) item.child.send({ ...message, kind: 'theme-release' });
    const exited = once(item.child, 'exit'); item.child.send({ kind: 'stop' }); await exited;
  }
  await fs.rm(item.root, { recursive: true, force: true });
}
export function waitThemeMessage(item: ThemeChild, predicate: (message: any) => boolean): Promise<any> {
  const existing = item.messages.find(predicate); if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); item.child.off('message', receive); item.child.off('exit', exit); item.child.off('error', fail); };
    const fail = (error: Error) => { cleanup(); reject(error); };
    const exit = (code: number | null) => fail(new Error(`Theme child exited during latch ${code}`));
    const receive = (message: any) => { if (predicate(message)) { cleanup(); resolve(message); } };
    const timer = setTimeout(() => fail(new Error('Theme child message timed out')), 30000);
    item.child.on('message', receive); item.child.once('exit', exit); item.child.once('error', fail);
  });
}
export function releaseTheme(item: ThemeChild, message: any) { item.child.send({ ...message, kind: 'theme-release' }); }
export async function builtinOperation(item: ThemeChild, directory: string): Promise<any> {
  const id = randomUUID(); const result = waitThemeMessage(item, message => message.kind === 'result' && message.id === id);
  item.child.send({ kind: 'builtin-install', id, directory }); return result;
}
export function themeHttp(item: ThemeChild, route: string, method = 'GET', body?: Buffer, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; bytes: Buffer; json: () => any }>((resolve, reject) => {
    const call = request(new URL(route, item.base), { method, headers: { connection: 'close', 'x-forwarded-for': item.ip, ...(body ? { 'Content-Length': String(body.length) } : {}), ...headers } }, reply => {
      const chunks: Buffer[] = []; reply.on('data', bytes => chunks.push(bytes)); reply.on('error', reject);
      reply.on('end', () => { const bytes = Buffer.concat(chunks); resolve({ status: reply.statusCode!, headers: reply.headers, bytes, json: () => JSON.parse(bytes.toString()) }); });
    });
    call.once('error', reject); call.end(body);
  });
}
export async function themeFixture() {
  const prisma = getTestPrisma(), actor = await createTestUser({ role: 'ADMIN' });
  const children: ThemeChild[] = [], slugs: string[] = [];
  const priorActive = await prisma.themeActive.findMany();
  const primary = await startThemeChild(); children.push(primary);
  const start = async (role = 'http', barrier?: string) => { const item = await startThemeChild(role, barrier); children.push(item); return item; };
  const mutate = (item: ThemeChild, route: string, method: string, body?: unknown) => themeHttp(item, route, method, body === undefined ? undefined : Buffer.from(JSON.stringify(body)), { Authorization: `Bearer ${signJwt(actor)}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) });
  const upload = async (item: ThemeChild, bytes: Buffer, confirm = true) => {
    const boundary = randomUUID();
    const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="confirmUnsigned"\r\n\r\n${confirm}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="theme.zip"\r\nContent-Type: application/zip\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    return themeHttp(item, '/api/v1/extensions/theme/install', 'POST', body, { Authorization: `Bearer ${signJwt(actor)}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` });
  };
  const install = async (item = primary, target: 'shop' | 'admin' = 'shop') => {
    const slug = `b4-${randomUUID().slice(0, 12)}`; slugs.push(slug);
    const files = await themeFiles(slug, target), bytes = await zipTheme(files), response = await upload(item, bytes);
    if (response.status !== 200) throw new Error(response.bytes.toString());
    return { slug, files, bytes, record: response.json().data };
  };
  const close = async () => {
    for (const item of children) await stopThemeChild(item);
    await prisma.themeActive.deleteMany({ where: { slug: { in: slugs } } });
    for (const row of priorActive) await prisma.themeActive.upsert({ where: { target: row.target }, create: row, update: row });
    await prisma.themeActivation.deleteMany({ where: { slug: { in: slugs } } });
    await prisma.theme.deleteMany({ where: { slug: { in: slugs } } });
    await prisma.adminAuditEvent.deleteMany({ where: { targetId: { in: slugs } } });
    await prisma.adminStaffAuditLog.deleteMany({ where: { staffUserId: actor.id } });
    await prisma.pluginOperationLease.deleteMany({ where: { slug: { in: slugs.flatMap(slug => [`theme:package:${slug}`]) } } });
    await prisma.user.delete({ where: { id: actor.id } });
    const redis = new Redis(process.env.REDIS_URL!);
    try {
      for (const item of children) { const keys = await redis.keys(`jiffoo:protection:rl:*:ip:${item.ip}`); if (keys.length) await redis.del(...keys); }
      await redis.del(`jiffoo:protection:rl:user:user:${actor.id}`);
    } finally { redis.disconnect(); }
  };
  return { prisma, actor, primary, children, slugs, priorActive, start, mutate, upload, install, close };
}

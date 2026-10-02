import { afterAll, describe, expect, it } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { snapshotPluginRows, restoreBuiltinRows } from '../helpers/plugin-db-snapshot';

function message(child: ChildProcess, kind: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      child.off('message', receive);
      child.off('error', fail);
      child.off('exit', exit);
    };
    const fail = (error: Error) => { cleanup(); reject(error); };
    const exit = (code: number | null, signal: string | null) => {
      fail(new Error(`Child exited before ${kind}: code=${code}, signal=${signal}`));
    };
    const receive = (value: any) => {
      if (value?.kind !== kind && value?.kind !== 'error') return;
      cleanup();
      if (value.kind === 'error') reject(new Error(value.message));
      else resolve(value);
    };
    child.on('message', receive);
    child.on('error', fail);
    child.on('exit', exit);
  });
}

describe('cross-process immutable plugin cache', () => {
  const roots: string[] = [];
  afterAll(async () => {
    await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true })));
  });

  it('F starts a real process with an empty cache and runs a builtin', async () => {
    const slugs = (await fs.readdir(path.resolve('builtin-plugins'), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    const before = await snapshotPluginRows(slugs);
    try {
    await syncBuiltinPlugins(path.resolve('builtin-plugins'));
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'builtin-empty-cache-'));
    roots.push(root);
    const child = fork(path.resolve('tests/helpers/builtin-cache-child.ts'), [], {
      execArgv: ['--import', 'tsx'], stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env, EXTENSIONS_PATH: root, NODE_ENV: 'test' },
    });
    let output = '';
    child.stdout?.on('data', (data) => { output += data.toString(); });
    child.stderr?.on('data', (data) => { output += data.toString(); });
    const exited = once(child, 'exit');
    const completed = message(child, 'done');
    const result = await completed.catch((error) => { throw new Error(`${error.message}\n${output}`); });
    await exited;
    expect(result.result).toMatchObject({ options: [{ id: 'free', amountMinor: 0 }] });
    const entries = await fs.readdir(path.join(root, 'plugins', 'free-shipping'));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      await restoreBuiltinRows(before, slugs);
    }
  });

  it('G two real processes publish the same hash atomically on one shared path', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shared-plugin-cache-'));
    roots.push(root);
    const source = path.join(root, 'source');
    await fs.mkdir(source);
    await fs.writeFile(path.join(source, 'manifest.json'), '{}');
    const slug = `publish-${randomUUID().slice(0, 12)}`;
    const zipHash = createHash('sha256').update(slug).digest('hex');
    const children = [0, 1].map(() => fork(path.resolve('tests/helpers/plugin-publish-child.ts'), [], {
      execArgv: ['--import', 'tsx'], stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      env: { ...process.env, EXTENSIONS_PATH: root, NODE_ENV: 'test', JIFFOO_TEST_PLUGIN_PUBLISH_BARRIER: '1' },
    }));
    try {
      const ready = children.map((child) => message(child, 'ready'));
      await Promise.all(ready);
      const atBarrier = children.map((child) => message(child, 'plugin-publish-ready'));
      for (const child of children) child.send({ kind: 'publish', slug, zipHash, source });
      await Promise.all(atBarrier);
      const target = path.join(root, 'plugins', slug, zipHash);
      await expect(fs.stat(target)).rejects.toMatchObject({ code: 'ENOENT' });
      const finished = children.map((child) => message(child, 'done'));
      for (const child of children) child.send({ kind: 'plugin-publish-release' });
      const outcomes = await Promise.all(finished);
      expect(outcomes.map((outcome) => outcome.published).sort()).toEqual([false, true]);
      expect(await fs.readFile(path.join(target, '.complete.json'), 'utf8')).toBe(JSON.stringify({ slug, zipHash }));
      expect(await fs.readdir(path.join(root, 'plugins', slug))).toEqual([zipHash]);
    } finally {
      const exits = children.map((child) => once(child, 'exit'));
      for (const child of children) child.send({ kind: 'stop' });
      await Promise.all(exits);
    }
  });
});

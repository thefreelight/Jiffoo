import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUpdateExecutor } from '@/core/upgrade/executors';

const originalCwd = process.cwd();

function createTempExecutable(dir: string, name: string): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, '#!/bin/sh\nexit 0\n', 'utf8');
  fs.chmodSync(file, 0o755);
  return file;
}

afterEach(() => {
  vi.unstubAllEnvs();
  process.chdir(originalCwd);
});

describe('upgrade executors', () => {
  it('reports single-host executor as available when updater binary exists', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jiffoo-updater-single-'));
    const updaterBinary = createTempExecutable(tempDir, 'jiffoo-updater');
    vi.stubEnv('JIFFOO_UPDATER_BIN', updaterBinary);

    const executor = createUpdateExecutor('single-host');
    const availability = await executor.probe();

    expect(availability.available).toBe(true);
    expect(availability.updaterBinary).toBe(updaterBinary);
  });

  it('reports docker-compose executor as unavailable without compose file', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jiffoo-updater-compose-missing-'));
    const updaterBinary = createTempExecutable(tempDir, 'jiffoo-updater');
    vi.stubEnv('JIFFOO_UPDATER_BIN', updaterBinary);
    process.chdir(tempDir);

    const executor = createUpdateExecutor('docker-compose');
    const availability = await executor.probe();

    expect(availability.available).toBe(false);
    expect(availability.guidance).toContain('Docker Compose');
  });

  it('reports docker-compose executor as available when updater and compose file exist', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jiffoo-updater-compose-ready-'));
    const updaterBinary = createTempExecutable(tempDir, 'jiffoo-updater');
    const composeFile = path.join(tempDir, 'docker-compose.yml');
    fs.writeFileSync(composeFile, 'services: {}\n', 'utf8');
    vi.stubEnv('JIFFOO_UPDATER_BIN', updaterBinary);
    process.chdir(tempDir);

    const executor = createUpdateExecutor('docker-compose');
    const availability = await executor.probe();

    expect(availability.available).toBe(true);
    expect(availability.updaterBinary).toBe(updaterBinary);
  });

  it('reports docker-compose executor as available when updater agent is reachable', async () => {
    vi.stubEnv('JIFFOO_UPDATER_URL', 'http://updater:3015');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
      })) as typeof fetch,
    );

    const executor = createUpdateExecutor('docker-compose');
    const availability = await executor.probe();

    expect(availability.available).toBe(true);
  });

  it('reports docker-compose executor as unavailable when updater agent is configured but unreachable', async () => {
    vi.stubEnv('JIFFOO_UPDATER_URL', 'http://updater:3015');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connect ECONNREFUSED');
      }) as typeof fetch,
    );

    const executor = createUpdateExecutor('docker-compose');
    const availability = await executor.probe();

    expect(availability.available).toBe(false);
    expect(availability.guidance).toContain('JIFFOO_UPDATER_URL');
  });

  it('reports k8s executor as available when the inferred updater bridge is reachable', async () => {
    vi.stubEnv('KUBERNETES_SERVICE_HOST', '10.96.0.1');
    vi.stubEnv('POD_NAMESPACE', 'jiffoo-mall-prod');
    vi.stubEnv('JIFFOO_HELM_RELEASE_NAME', 'jiffoo-core');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe('http://jiffoo-k8s-updater.jiffoo-mall-prod.svc.cluster.local:3015/health');
        return { ok: true } as Response;
      }) as typeof fetch,
    );

    const executor = createUpdateExecutor('k8s');
    const availability = await executor.probe();

    expect(availability.available).toBe(true);
  });

  it('reports k8s executor as available when cluster updater bridge is reachable', async () => {
    vi.stubEnv('JIFFOO_UPDATER_URL', 'http://updater.k8s.svc:3015');
    vi.stubEnv('JIFFOO_HELM_RELEASE_NAME', 'jiffoo-core');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
      })) as typeof fetch,
    );

    const executor = createUpdateExecutor('k8s');
    const availability = await executor.probe();

    expect(availability.available).toBe(true);
  });

  it('infers the default k8s updater bridge URL when env override is absent', async () => {
    vi.stubEnv('KUBERNETES_SERVICE_HOST', '10.96.0.1');
    vi.stubEnv('POD_NAMESPACE', 'jiffoo-mall-prod');
    vi.stubEnv('JIFFOO_HELM_RELEASE_NAME', 'jiffoo-core');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe('http://jiffoo-k8s-updater.jiffoo-mall-prod.svc.cluster.local:3015/health');
        return { ok: true } as Response;
      }) as typeof fetch,
    );

    const executor = createUpdateExecutor('k8s');
    const availability = await executor.probe();

    expect(availability.available).toBe(true);
  });

  it('reports k8s executor as unavailable when cluster updater bridge is configured but unreachable', async () => {
    vi.stubEnv('JIFFOO_UPDATER_URL', 'http://updater.k8s.svc:3015');
    vi.stubEnv('JIFFOO_HELM_RELEASE_NAME', 'jiffoo-core');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connect ECONNREFUSED');
      }) as typeof fetch,
    );

    const executor = createUpdateExecutor('k8s');
    const availability = await executor.probe();

    expect(availability.available).toBe(false);
    expect(availability.guidance).toContain('JIFFOO_UPDATER_URL');
  });

  it('reports unsupported mode as manual-only', async () => {
    const executor = createUpdateExecutor('unsupported');
    const availability = await executor.probe();

    expect(availability.available).toBe(false);
    expect(availability.guidance).toContain('manual core upgrade');
  });
});

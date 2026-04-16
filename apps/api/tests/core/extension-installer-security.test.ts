import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { describe, expect, it } from 'vitest';
import { ExtensionInstallerError } from '../../src/core/admin/extension-installer/errors';
import { validateDirectoryFiles, validateFileExtension, validateZipEntry } from '../../src/core/admin/extension-installer/security';

describe('extension installer security', () => {
  it('allows TypeScript declaration files in executable plugin packages', () => {
    expect(() => validateFileExtension('index.d.ts', 'plugin')).not.toThrow();
    expect(() => validateFileExtension('plugin.d.mts', 'plugin')).not.toThrow();
    expect(() => validateFileExtension('plugin.d.cts', 'plugin')).not.toThrow();
  });

  it('allows Prisma runtime binaries for executable plugin packages only', () => {
    expect(() =>
      validateFileExtension('node_modules/.prisma/client/libquery_engine-linux-musl-arm64-openssl-3.0.x.so.node', 'plugin'),
    ).not.toThrow();
    expect(() =>
      validateFileExtension('node_modules/@prisma/engines/libquery_engine-linux-musl-arm64-openssl-3.0.x.so.node', 'plugin'),
    ).not.toThrow();
    expect(() =>
      validateFileExtension('node_modules/some-other-native-addon/build/Release/addon.node', 'plugin'),
    ).toThrow(ExtensionInstallerError);
  });

  it('still rejects executable TypeScript source files in plugin packages', () => {
    expect(() => validateFileExtension('index.ts', 'plugin')).toThrow(ExtensionInstallerError);
    expect(() => validateFileExtension('index.tsx', 'plugin')).toThrow(ExtensionInstallerError);
  });

  it('allows Prisma runtime binaries when validating extracted plugin directories recursively', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-security-'));
    const prismaDir = path.join(tempRoot, 'node_modules/.prisma/client');

    try {
      await fs.mkdir(prismaDir, { recursive: true });
      await fs.writeFile(
        path.join(prismaDir, 'libquery_engine-linux-musl-arm64-openssl-3.0.x.so.node'),
        'binary-placeholder',
      );

      await expect(validateDirectoryFiles(tempRoot, 'plugin')).resolves.toBeUndefined();
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('allows the official embedded theme runtime bridge when explicitly enabled', () => {
    expect(() =>
      validateFileExtension('modelsfind-0.1.3/runtime/theme-runtime.js', 'theme-shop', {
        allowThemeRuntimeScript: true,
      }),
    ).not.toThrow();
  });

  it('still rejects theme runtime scripts for regular local theme packs', () => {
    expect(() =>
      validateFileExtension('modelsfind-0.1.3/runtime/theme-runtime.js', 'theme-shop'),
    ).toThrow(ExtensionInstallerError);
  });

  it('allows zip directory entries that include semver dots', () => {
    expect(() =>
      validateZipEntry('modelsfind-0.1.3/', 0, '/tmp/theme-pack-test', 'theme-shop'),
    ).not.toThrow();
  });
});

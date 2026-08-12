import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const scratchDirectories: string[] = [];

afterEach(() => {
  for (const directory of scratchDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('native product baseline migration', () => {
  it('preinstalls exactly nine plugins with the required activation policy', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jiffoo-native-baseline-'));
    scratchDirectories.push(directory);
    const database = join(directory, 'baseline.sqlite');
    const migrations = resolve(import.meta.dirname, '../migrations');

    for (const migration of [
      '0001_native_platform.sql',
      '0002_native_core.sql',
      '0020_native_plugin_settings.sql',
      '0038_native_product_baseline.sql',
    ]) {
      execFileSync('sqlite3', [database, `.read ${join(migrations, migration)}`]);
    }

    const rows = execFileSync('sqlite3', [database,
      "SELECT plugin_slug || ':' || enabled FROM native_plugin_instances ORDER BY plugin_slug;",
    ], { encoding: 'utf8' }).trim().split('\n');
    expect(rows).toEqual([
      'affiliate:0',
      'cms:1',
      'coupon:1',
      'i18n:1',
      'media-storage:1',
      'reviews:1',
      'seo:1',
      'subscription:0',
      'wallet:0',
    ]);
    expect(execFileSync('sqlite3', [database,
      "SELECT value FROM runtime_metadata WHERE key = 'core_schema_version';",
    ], { encoding: 'utf8' }).trim()).toBe('0038');
  });

  it('preserves an existing operator-selected state and configuration', () => {
    const directory = mkdtempSync(join(tmpdir(), 'jiffoo-native-baseline-upgrade-'));
    scratchDirectories.push(directory);
    const database = join(directory, 'baseline.sqlite');
    const migrations = resolve(import.meta.dirname, '../migrations');

    for (const migration of ['0001_native_platform.sql', '0002_native_core.sql', '0020_native_plugin_settings.sql']) {
      execFileSync('sqlite3', [database, `.read ${join(migrations, migration)}`]);
    }
    execFileSync('sqlite3', [database,
      `INSERT INTO native_plugin_instances
        (id, plugin_slug, instance_key, enabled, config_json, encrypted_secrets_json)
       VALUES ('existing-subscription', 'subscription', 'default', 1, '{"plan":"pro"}', '{"key":"ciphertext"}');`,
    ]);
    execFileSync('sqlite3', [database, `.read ${join(migrations, '0038_native_product_baseline.sql')}`]);

    expect(execFileSync('sqlite3', [database,
      "SELECT id || '|' || enabled || '|' || config_json || '|' || encrypted_secrets_json FROM native_plugin_instances WHERE plugin_slug = 'subscription';",
    ], { encoding: 'utf8' }).trim()).toBe('existing-subscription|1|{"plan":"pro"}|{"key":"ciphertext"}');
  });
});

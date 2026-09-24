import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sources(join(directory, entry.name))
      : /\.(css|ts|tsx)$/.test(entry.name) ? [join(directory, entry.name)] : []);
}

describe('Admin assets', () => {
  it('E contains no external host references in app, components or styles', () => {
    const root = resolve(__dirname, '..');
    for (const directory of ['app', 'components', 'styles']) {
      const path = join(root, directory);
      if (directory === 'styles' && !readdirSync(root).includes(directory)) continue;
      for (const file of sources(path)) {
        expect(readFileSync(file, 'utf8'), file)
          .not.toMatch(/https?:\/\/|(?<!:)\/\/[a-z][\w.-]*\.[a-z]{2,}|@import\s+(?:url\()?['"]?\/\/[a-z]/i);
      }
    }
  });
});

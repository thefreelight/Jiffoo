import { describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

const sourceRoot = path.resolve(__dirname, '../../src');
const storageRoot = path.join(sourceRoot, 'core', 'storage');
const forbiddenPatterns = [
  /process\.env\.EXTENSIONS_(?:PATH|ROOT)/,
  /\bEXTENSIONS_ROOT\b/,
  /path\.(?:join|resolve)\(\s*process\.cwd\(\)\s*,\s*['\"]uploads['\"]/,
];

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (target === storageRoot) return [];
    if (entry.isDirectory()) return sourceFiles(target);
    return entry.isFile() && target.endsWith('.ts') ? [target] : [];
  }));
  return nested.flat();
}

describe('storage boundary guard', () => {
  it('requires plugin package and uploaded file paths to resolve through storage stores', async () => {
    const violations: string[] = [];
    for (const file of await sourceFiles(sourceRoot)) {
      const source = await fs.readFile(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(source)) violations.push(`${path.relative(sourceRoot, file)}: ${pattern}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

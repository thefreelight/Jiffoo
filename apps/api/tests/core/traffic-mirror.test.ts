import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The traffic core and the default channel lists are kept as byte-identical
// copies in the native worker and here, because the worker imports no
// workspace packages. Either copy may be edited; copy it over the other
// before these tests are run again.
describe('traffic core mirrors', () => {
  const nativeSource = path.resolve(__dirname, '../../../cloudflare-native-core-api/src');
  const nodeSource = path.resolve(__dirname, '../../src/core/traffic');
  const read = (directory: string, file: string) => readFileSync(path.join(directory, file), 'utf8');

  it.each(['traffic-core.ts', 'traffic-default-rules.ts'])('keeps %s identical to the native worker copy', (file) => {
    expect(read(nodeSource, file)).toBe(read(nativeSource, file));
  });
});

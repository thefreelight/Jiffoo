import { describe, expect, it } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { inflateThemeZip } from './theme-zip';

function zipEntry(path: string, text: string, compression = 0): ArrayBuffer {
  const name = new TextEncoder().encode(path);
  const data = new TextEncoder().encode(text);
  const compressed = compression === 8 ? new Uint8Array(deflateRawSync(data)) : data;
  const local = new Uint8Array(30 + name.length + compressed.length);
  const localView = new DataView(local.buffer);
  localView.setUint32(0, 0x04034b50, true);
  localView.setUint16(4, 20, true);
  localView.setUint16(8, compression, true);
  localView.setUint32(18, compressed.length, true);
  localView.setUint32(22, data.length, true);
  localView.setUint16(26, name.length, true);
  local.set(name, 30);
  local.set(compressed, 30 + name.length);

  const central = new Uint8Array(46 + name.length);
  const centralView = new DataView(central.buffer);
  centralView.setUint32(0, 0x02014b50, true);
  centralView.setUint16(4, 20, true);
  centralView.setUint16(6, 20, true);
  centralView.setUint16(10, compression, true);
  centralView.setUint32(20, compressed.length, true);
  centralView.setUint32(24, data.length, true);
  centralView.setUint16(28, name.length, true);
  central.set(name, 46);

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, 1, true);
  endView.setUint16(10, 1, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, local.length, true);

  const output = new Uint8Array(local.length + central.length + end.length);
  output.set(local);
  output.set(central, local.length);
  output.set(end, local.length + central.length);
  return output.buffer;
}

describe('inflateThemeZip', () => {
  it('extracts stored package entries', async () => {
    const files = await inflateThemeZip(zipEntry('theme.json', '{"slug":"imagic-studio"}'));
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('theme.json');
    expect(new TextDecoder().decode(files[0].data)).toContain('imagic-studio');
  });

  it('extracts deflated runtime files used by published theme packages', async () => {
    const files = await inflateThemeZip(zipEntry('runtime/theme-runtime.js', 'globalThis.__theme = true;', 8));
    expect(new TextDecoder().decode(files[0].data)).toContain('__theme');
  });

  it('rejects traversal paths before R2 writes', async () => {
    await expect(inflateThemeZip(zipEntry('../escape.json', '{}'))).rejects.toThrow('unsafe file path');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { installThemePackage, readActiveThemeSnapshot, unpackThemePackage } from './theme-install';

function crc32(bytes: Uint8Array): number {
  let table: number[] | null = null;
  if (!table) {
    table = [];
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Build a stored-method ZIP archive (valid, uncompressed). */
function buildZip(files: Array<{ name: string; bytes: Uint8Array }>): ArrayBuffer {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.bytes);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true); // stored
    lv.setUint32(14, crc, true);
    lv.setUint32(18, file.bytes.length, true);
    lv.setUint32(22, file.bytes.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    chunks.push(local, file.bytes);
    const cd = new Uint8Array(46 + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, file.bytes.length, true);
    cv.setUint32(24, file.bytes.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cd.set(name, 46);
    central.push(cd);
    offset += local.length + file.bytes.length;
  }
  const centralSize = central.reduce((sum, c) => sum + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const total = offset + centralSize + 22;
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of [...chunks, ...central, eocd]) { out.set(chunk, at); at += chunk.length; }
  return out.buffer;
}

const THEME_JSON = JSON.stringify({ slug: 'remoteradar', version: '0.0.38', defaultConfig: { site: { headline: 'x' } } });

function packageBytes(): ArrayBuffer {
  return buildZip([
    { name: 'theme.json', bytes: new TextEncoder().encode(THEME_JSON) },
    { name: 'runtime/theme-runtime.js', bytes: new TextEncoder().encode('/* runtime bundle */') },
    { name: 'tokens.css', bytes: new TextEncoder().encode(':root{}') },
  ]);
}

function fakeEnv() {
  const objects = new Map<string, Uint8Array>();
  let activeRow = JSON.stringify({
    success: true,
    data: { slug: 'remoteradar', version: '0.0.37', source: 'official-market', type: 'pack', config: { brand: { primaryColor: '#3157e5' } } },
  });
  const env = {
    DB: {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...bindings: unknown[]) => ({
          first: vi.fn(async () => (sql.includes('core_api_snapshots WHERE') ? { payload: activeRow, status_code: 200 } : null)),
          run: vi.fn(async () => {
            if (sql.includes('INSERT INTO core_api_snapshots')) {
              activeRow = String(bindings[1]);
            }
            return { success: true };
          }),
        })),
        first: vi.fn(async () => (sql.includes('core_api_snapshots WHERE') ? { payload: activeRow, status_code: 200 } : null)),
      })),
    },
    ASSETS: {
      put: vi.fn(async (key: string, value: Uint8Array) => { objects.set(key, value); }),
    },
  };
  return { env: env as never, objects, currentActive: () => JSON.parse(activeRow) };
}


describe('native theme package installation', () => {
  it('unpacks the package and preserves the manifest version', async () => {
    const theme = await unpackThemePackage(packageBytes());
    expect(theme.version).toBe('0.0.38');
    expect(theme.files.map((file) => file.path).sort()).toEqual(['runtime/theme-runtime.js', 'theme.json', 'tokens.css']);
    expect(theme.config).toMatchObject({ site: { headline: 'x' } });
  });

  it('materializes files into R2 and moves the active snapshot, keeping merchant config', async () => {
    const { env, objects, currentActive } = fakeEnv();
    const result = await installThemePackage(env, {
      slug: 'remoteradar', version: '0.0.38', packageBytes: packageBytes(),
    });
    expect(result).toMatchObject({ slug: 'remoteradar', kind: 'theme', version: '0.0.38' });
    expect([...objects.keys()].filter((key) => key.includes('runtime/theme-runtime.js'))).toHaveLength(1);
    expect(objects.get('extensions/themes/shop/.versions/remoteradar/0.0.38/checksums.json')).toBeTruthy();
    const active = currentActive();
    expect(active.data).toMatchObject({ slug: 'remoteradar', version: '0.0.38', type: 'pack' });
    expect(active.data.config).toMatchObject({ brand: { primaryColor: '#3157e5' } });
    void env;
  });

  it('rejects a package whose version does not match the request', async () => {
    const { env } = fakeEnv();
    await expect(installThemePackage(env, {
      slug: 'remoteradar', version: '0.0.99', packageBytes: packageBytes(),
    })).rejects.toThrow('does not match');
  });

  it('reads the active theme snapshot through the canonical queryless key', async () => {
    const { env } = fakeEnv();
    const active = await readActiveThemeSnapshot(env);
    expect(active?.data).toMatchObject({ slug: 'remoteradar', version: '0.0.37' });
  });
});

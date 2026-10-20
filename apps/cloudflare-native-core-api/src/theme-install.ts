/**
 * Native theme installation from official .jtheme artifacts.
 *
 * A .jtheme package is a ZIP container holding the theme manifest
 * (theme.json), the committed runtime bundle (runtime/theme-runtime.js),
 * tokens, templates, schemas, and assets. Installation materializes the
 * package into the R2 assets bucket under the versioned shop theme path
 * the storefront already serves
 * (extensions/themes/shop/.versions/<slug>/<version>/...) and moves the
 * active-theme snapshot pointer to the new version, preserving the
 * merchant's stored configuration.
 */

export interface ThemeInstallEnv {
  DB: {
    prepare(query: string): {
      bind(...values: unknown[]): {
        first<T = unknown>(): Promise<T | null>;
        run(): Promise<unknown>;
      };
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results?: T[] }>;
    };
  };
  ASSETS: {
    put(key: string, value: Uint8Array): Promise<unknown>;
  };
}

export interface ThemePackage {
  version: string;
  config: Record<string, unknown>;
  files: Array<{ path: string; bytes: Uint8Array }>;
}

const ACTIVE_SNAPSHOT_KEY = 'core:snapshot:/api/v1/themes/active';
const RUNTIME_PATH = 'runtime/theme-runtime.js';
const MANIFEST_PATH = 'theme.json';

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

/** Minimal ZIP reader: central directory + local headers, stored/deflate. */
export async function readZipEntries(bytes: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes);
  const raw = new Uint8Array(bytes);
  let eocd = -1;
  const floor = Math.max(0, bytes.byteLength - 22 - 65_536);
  for (let i = bytes.byteLength - 22; i >= floor; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Theme package is not a valid archive');
  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const files = new Map<string, Uint8Array>();
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('Theme package central directory is corrupt');
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(raw.slice(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/')) continue;
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = raw.slice(dataStart, dataStart + compressedSize);
    files.set(name, method === 0 ? compressed : await inflateRaw(compressed));
  }
  if (!files.size) throw new Error('Theme package is empty');
  return files;
}

function stripCommonRoot(files: Map<string, Uint8Array>): Map<string, Uint8Array> {
  const names = [...files.keys()];
  const first = names[0]!.split('/');
  if (first.length < 2) return files;
  const root = `${first[0]}/`;
  if (!names.every((name) => name.startsWith(root))) return files;
  const stripped = new Map<string, Uint8Array>();
  for (const [name, bytes] of files) stripped.set(name.slice(root.length), bytes);
  return stripped;
}

export async function unpackThemePackage(bytes: ArrayBuffer): Promise<ThemePackage> {
  let files = stripCommonRoot(await readZipEntries(bytes));
  const manifestEntry = files.get(MANIFEST_PATH);
  if (!manifestEntry) throw new Error('Theme package is missing theme.json');
  const manifest = JSON.parse(new TextDecoder().decode(manifestEntry)) as {
    version?: string; defaultConfig?: Record<string, unknown>;
  };
  const version = String(manifest.version ?? '').trim();
  if (!version) throw new Error('Theme package manifest has no version');
  const runtimeEntry = files.get(RUNTIME_PATH);
  if (!runtimeEntry) throw new Error('Theme package is missing the runtime bundle');
  files = new Map([...files.entries()].filter(([name]) => !name.endsWith('/')));
  return {
    version,
    config: (manifest.defaultConfig && typeof manifest.defaultConfig === 'object')
      ? manifest.defaultConfig
      : {},
    files: [...files.entries()].map(([path, bytes]) => ({ path, bytes })),
  };
}

type ActiveThemePayload = { success: boolean; data: {
  slug: string; version: string; source?: string; type?: string; config?: Record<string, unknown>;
} };

export async function readActiveThemeSnapshot(env: ThemeInstallEnv): Promise<ActiveThemePayload | null> {
  const row = await env.DB.prepare(
    'SELECT payload, status_code FROM core_api_snapshots WHERE cache_key = ?1 AND status_code = 200',
  ).bind(ACTIVE_SNAPSHOT_KEY).first<{ payload: string; status_code: number }>();
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.payload) as ActiveThemePayload;
    return parsed?.data?.slug ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeActiveThemeSnapshot(env: ThemeInstallEnv, payload: ActiveThemePayload): Promise<void> {
  const body = JSON.stringify(payload);
  await env.DB.prepare(
    `INSERT INTO core_api_snapshots (cache_key, request_path, payload, status_code, content_type, source_updated_at, refreshed_at)
     VALUES (?1, '/api/v1/themes/active', ?2, 200, 'application/json', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(cache_key) DO UPDATE SET payload = ?2, status_code = 200,
       content_type = 'application/json', source_updated_at = CURRENT_TIMESTAMP, refreshed_at = CURRENT_TIMESTAMP`,
  ).bind(ACTIVE_SNAPSHOT_KEY, body).run();
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function installThemePackage(env: ThemeInstallEnv, input: {
  slug: string; version: string; packageBytes: ArrayBuffer;
}): Promise<{ slug: string; kind: 'theme'; version: string; files: number }> {
  const theme = await unpackThemePackage(input.packageBytes);
  if (theme.version !== input.version) {
    throw new Error(`Theme package version ${theme.version} does not match requested ${input.version}`);
  }
  if (!theme.files.some((file) => file.path === RUNTIME_PATH)) {
    throw new Error('Theme package is missing the runtime bundle');
  }
  const prefix = `extensions/themes/shop/.versions/${input.slug}/${input.version}`;
  const checksums: Record<string, string> = {};
  for (const file of theme.files) {
    await env.ASSETS.put(`${prefix}/${file.path}`, file.bytes);
    checksums[file.path] = await sha256Hex(file.bytes);
  }
  await env.ASSETS.put(`${prefix}/checksums.json`,
    new TextEncoder().encode(JSON.stringify({ algorithm: 'sha256', files: checksums })));

  const previous = await readActiveThemeSnapshot(env);
  const previousData = previous?.data;
  const payload: ActiveThemePayload = {
    success: true,
    data: {
      slug: input.slug,
      version: input.version,
      source: 'official-market',
      type: 'pack',
      config: previousData?.config ?? theme.config,
    },
  };
  await writeActiveThemeSnapshot(env, payload);
  return { slug: input.slug, kind: 'theme', version: input.version, files: theme.files.length };
}

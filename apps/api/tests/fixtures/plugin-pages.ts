import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import type { PluginManifest } from 'shared';

export function pageManifest(slug = 'page-fixture'): PluginManifest {
  return {
    schemaVersion: 1, slug, name: 'Page fixture', version: '1.0.0', description: 'Page fixture',
    runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', entryModule: 'server/index.js', permissions: [],
    ui: { bridgeVersion: 1, assetDirectory: 'ui', storefrontPages: [{ id: 'studio', path: '/studio', entry: 'index.html',
      title: { en: 'Studio', 'zh-Hans': '创作空间', 'zh-Hant': '創作空間' }, placements: ['header-nav'], requiresLogin: true }],
    adminPages: [{ id: 'reports', path: '/reports', entry: 'admin.html', title: { en: 'Reports', 'zh-Hans': '报表', 'zh-Hant': '報表' } }] },
    tasks: [{ name: 'render', version: 1, concurrency: 2, maxAttempts: 5, maxRuntimeSeconds: 600, onFinalFailure: { maxRuntimeSeconds: 30 } }],
    services: [{ name: 'wallet', version: 1, methods: [{ name: 'debit', idempotencyRequired: true, schema: 'services/debit.json' }] }],
    serviceDependencies: [{ plugin: 'wallet-provider', service: 'wallet', version: 1, methods: ['debit'] }],
  };
}
export function pageFiles(manifest = pageManifest()) {
  return [
    { path: 'manifest.json', content: Buffer.from(JSON.stringify(manifest)) },
    { path: 'server/index.js', content: Buffer.from('module.exports = { register() {} };') },
    { path: 'services/debit.json', content: Buffer.from('{"input":{"type":"object"},"result":{"type":"boolean"},"errorDetails":{"type":"null"}}') },
    { path: 'ui/index.html', content: Buffer.from('<!doctype html><html><script type="module" src="./assets/app.js"></script></html>') },
    { path: 'ui/admin.html', content: Buffer.from('<!doctype html><html><body>Reports</body></html>') },
    { path: 'ui/assets/app.js', content: Buffer.from('export const load = () => import("./chunk.js");') },
    { path: 'ui/assets/chunk.js', content: Buffer.from('export default "studio";') },
    { path: 'ui/assets/style.css', content: Buffer.from('body { color: black; }') },
    { path: 'ui/assets/data.json', content: Buffer.from('{"ready":true}') },
    { path: 'ui/assets/font.woff2', content: Buffer.concat([Buffer.from('wOF2'), Buffer.from([0, 1, 255, 2])]) },
  ];
}
export async function pageZip(files: Array<{ path: string; content: Buffer }>): Promise<Buffer> {
  const stream = new PassThrough(), chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk)); stream.on('end', () => resolve(Buffer.concat(chunks))); stream.on('error', reject);
  });
  const zip = archiver('zip', { zlib: { level: 9 } });
  zip.on('error', error => stream.destroy(error)); zip.pipe(stream);
  for (const file of files) zip.append(file.content, { name: file.path, date: new Date('1980-01-01'), mode: 0o644 });
  void zip.finalize(); return done;
}

export async function symlinkDirectoryZip(manifest = pageManifest()): Promise<Buffer> {
  const bytes = await pageZip([...pageFiles(manifest), { path: 'ui/linkx', content: Buffer.from('../outside') }]);
  const original = Buffer.from('ui/linkx'), replacement = Buffer.from('ui/link/');
  let offset = 0, renamed = 0;
  while ((offset = bytes.indexOf(original, offset)) !== -1) {
    replacement.copy(bytes, offset); offset += original.length; renamed++;
  }
  if (renamed !== 2) throw new Error('Expected local and central ZIP entry names');
  const signature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  offset = bytes.indexOf(signature);
  while (offset !== -1 && offset + 46 <= bytes.length) {
    const length = bytes.readUInt16LE(offset + 28);
    if (bytes.toString('utf8', offset + 46, offset + 46 + length) === 'ui/link/') {
      bytes.writeUInt16LE(0x0314, offset + 4);
      bytes.writeUInt32LE((0o120777 * 0x10000) >>> 0, offset + 38);
      return bytes;
    }
    offset = bytes.indexOf(signature, offset + 4);
  }
  throw new Error('Expected central ZIP entry for the symlink fixture');
}

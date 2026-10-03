#!/usr/bin/env node
import archiver from 'archiver';
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { finished } from 'node:stream/promises';
import { getPluginManifestIssues } from 'shared';
import { createPlugin } from './create';
import {
  CERT_PATH, SIGNATURE_PATH, extensionMaxFileSize, getPluginFileViolation, isPathWithinExtensionBase, PLUGIN_MAX_ZIP_SIZE, readPluginZipEntries,
  signPackage, verifyPublisherCertificate, validatePluginZipPaths,
  type PluginZipEntry,
} from 'shared/plugin-signing';

const HELP = `jiffoo-plugin create --slug <slug> --name <name> --output <dir> [--category integration|shipping|payment]
jiffoo-plugin keygen --out <private.pem>
jiffoo-plugin pack --input <dir> --output <zip>
jiffoo-plugin sign --input <unsigned.zip> --certificate <cert.json> --key <private.pem> --output <signed.zip>
pack excludes exactly: .git/; node_modules/; .DS_Store; .env; .env.*; *.pem; *.key`;
const date = new Date('1980-01-01T00:00:00.000Z');
const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');
type Entry = { path: string; content: Buffer };

function failure(code: string, file?: string): never {
  throw new Error(`${code}${file ? `: ${file}` : ''}`);
}
function options(args: string[], names: string[], optionalNames: string[] = []): Record<string, string> {
  const result: Record<string, string> = {};
  if (args.length % 2 || args.length < names.length * 2 || args.length > (names.length + optionalNames.length) * 2) failure('INVALID_ARGUMENTS');
  for (let i = 0; i < args.length; i += 2) {
    if (![...names, ...optionalNames].includes(args[i]) || !args[i + 1] || result[args[i]]) failure('INVALID_ARGUMENTS');
    result[args[i]] = args[i + 1];
  }
  if (names.some(name => !result[name])) failure('INVALID_ARGUMENTS');
  return result;
}
function excluded(name: string): boolean {
  return name === '.git' || name === 'node_modules' || name === '.DS_Store' ||
    name === '.env' || name.startsWith('.env.') || name.endsWith('.pem') || name.endsWith('.key');
}
function assertNoPrivateKey(bytes: Buffer, file: string) {
  if (bytes.includes(Buffer.from('BEGIN PRIVATE KEY')) || bytes.includes(Buffer.from('BEGIN OPENSSH PRIVATE KEY'))) failure('PRIVATE_KEY_MATERIAL', file);
}
function checkContent(entries: Entry[]) {
  validatePluginZipPaths(entries.map((entry): PluginZipEntry => ({ ...entry, flags: 0x800, mode: 0o100644 })));
  if (entries.some((entry) => entry.path === CERT_PATH || entry.path === SIGNATURE_PATH || entry.path.startsWith('META-INF/jiffoo/'))) failure('SIGNATURE_MATERIAL_PRESENT');
  for (const entry of entries) {
    const violation = getPluginFileViolation(entry.path);
    if (violation) failure(violation.code, entry.path);
    if (entry.content.length > extensionMaxFileSize('plugin')) failure('FILE_TOO_LARGE', entry.path);
    assertNoPrivateKey(entry.content, entry.path);
  }
  const manifestEntry = entries.find((entry) => entry.path === 'manifest.json');
  if (!manifestEntry) failure('MISSING_MANIFEST', 'manifest.json');
  let manifest: unknown;
  try { manifest = JSON.parse(manifestEntry.content.toString('utf8')); } catch { failure('INVALID_JSON', 'manifest.json'); }
  const issue = getPluginManifestIssues(manifest)[0];
  if (issue) failure(issue.code, `manifest.json:${issue.path}`);
}
async function collect(root: string): Promise<Entry[]> {
  const result: Entry[] = [];
  async function visit(dir: string, relative: string) {
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      const name = relative ? `${relative}/${item.name}` : item.name;
      if (!isPathWithinExtensionBase(path.join(dir, item.name), root)) failure('PATH_TRAVERSAL', name);
      if (name === 'META-INF/jiffoo' || name.startsWith('META-INF/jiffoo/')) failure('SIGNATURE_MATERIAL_PRESENT', name);
      if (excluded(item.name)) continue;
      if (item.isDirectory()) await visit(path.join(dir, item.name), name);
      else if (item.isFile()) result.push({ path: name, content: await fs.readFile(path.join(dir, item.name)) });
      else failure('SPECIAL_FILE', name);
    }
  }
  await visit(root, '');
  return result.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
}
async function writeZip(output: string, entries: Entry[]) {
  const handle = await fs.open(output, 'wx', 0o600);
  const file = handle.createWriteStream();
  const archive = archiver('zip', { zlib: { level: 9 } });
  try {
    archive.on('error', (error) => file.destroy(error));
    archive.pipe(file);
    for (const entry of entries) archive.append(entry.content, { name: entry.path, date, mode: 0o644 });
    const completed = finished(file);
    await archive.finalize();
    await completed;
    if ((await fs.stat(output)).size > PLUGIN_MAX_ZIP_SIZE) failure('ZIP_TOO_LARGE', output);
  } catch (error) {
    file.destroy();
    await fs.rm(output, { force: true }).catch(() => {});
    throw error;
  }
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === 'help') { console.log(HELP); return; }
  if (command === 'create') {
    await createPlugin(options(args, ['--slug', '--name', '--output'], ['--category']));
  } else if (command === 'keygen') {
    const flags = options(args, ['--out']);
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    await fs.writeFile(flags['--out'], privateKey.export({ format: 'pem', type: 'pkcs8' }), { flag: 'wx', mode: 0o600 });
    console.log(publicKey.export({ format: 'der', type: 'spki' }).toString('base64url'));
  } else if (command === 'pack') {
    const flags = options(args, ['--input', '--output']);
    const root = path.resolve(flags['--input']);
    const output = path.resolve(flags['--output']);
    if (output.startsWith(`${root}${path.sep}`)) failure('OUTPUT_INSIDE_INPUT', output);
    const entries = await collect(root);
    checkContent(entries);
    await writeZip(output, entries);
    for (const entry of entries) console.log(entry.path);
  } else if (command === 'sign') {
    const flags = options(args, ['--input', '--certificate', '--key', '--output']);
    const entries = readPluginZipEntries(await fs.readFile(flags['--input'])).map(({ path: name, content }) => ({ path: name, content }));
    checkContent(entries);
    const certificateBytes = await fs.readFile(flags['--certificate']);
    const certificate = verifyPublisherCertificate(certificateBytes);
    let privateKey;
    try { privateKey = createPrivateKey(await fs.readFile(flags['--key'], 'utf8')); }
    catch { failure('INVALID_PRIVATE_KEY', flags['--key']); }
    if (createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).toString('base64url') !== certificate.publicKey) failure('KEY_CERTIFICATE_MISMATCH');
    const content = [...entries, { path: CERT_PATH, content: certificateBytes }]
      .sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
    const listing = content.map((entry) => ({ path: entry.path, sha256: sha256(entry.content) }));
    content.push({ path: SIGNATURE_PATH, content: Buffer.from(JSON.stringify(signPackage(listing, privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()))) });
    content.sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
    await writeZip(path.resolve(flags['--output']), content);
  } else failure('UNKNOWN_COMMAND');
}
main().catch((error: unknown) => {
  console.error(error instanceof Error && /^[A-Z_]+(?::|$)/.test(error.message) ? error.message : 'IO_OR_PACKAGE_ERROR');
  process.exitCode = 1;
});

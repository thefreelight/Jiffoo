import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const OFFICIAL_ROOT_PUBLIC_KEY = 'MCowBQYDK2VwAyEAA_zy6wrHIT-xusqZjtIoRFlK0wwe_08awdPoFnJhs6o';
export const CERT_PATH = 'META-INF/jiffoo/publisher-cert.json';
export const SIGNATURE_PATH = 'META-INF/jiffoo/package-signature.json';
const CERT_DOMAIN = 'jiffoo.publisher-certificate.v1\n';
const PACKAGE_DOMAIN = 'jiffoo.plugin-package.v1\n';
const decoder = new TextDecoder('utf-8', { fatal: true });

export type PublisherCertificate = {
  schemaVersion: 1;
  publisherId: string;
  publisherName: string;
  algorithm: 'Ed25519';
  publicKey: string;
  rootSignature: string;
};
export type PackageSignature = {
  schemaVersion: 1;
  algorithm: 'Ed25519';
  files: Array<{ path: string; sha256: string }>;
  signature: string;
};
export type PublisherIdentity = {
  publisherId: string;
  publisherName: string;
  publisherCertificateFingerprint: string;
  signingRoot: 'official' | 'test';
};
export class PackageVerificationError extends Error {
  readonly statusCode = 422;
  constructor(readonly code: string) {
    super(code);
  }
}
const forbiddenExtensions = new Set(['.ts', '.tsx', '.jsx', '.sh', '.bat', '.cmd', '.ps1', '.exe', '.dll', '.so', '.dylib', '.node', '.map']);
export function getPluginFileViolation(filename: string): { code: string; extension?: string } | null {
  const segments = filename.replace(/\\/g, '/').toLowerCase().split('/');
  if (segments.some((segment, index) => segment === '.prisma' || (segment === '@prisma' && segments[index + 1] === 'client'))) {
    return { code: 'FORBIDDEN_PRISMA_CLIENT' };
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith('.d.ts') || lower.endsWith('.d.mts') || lower.endsWith('.d.cts')) return null;
  const extension = path.extname(filename).toLowerCase();
  return forbiddenExtensions.has(extension) ? { code: extension === '.node' ? 'FORBIDDEN_NATIVE_MODULE' : 'FORBIDDEN_FILE_TYPE', extension } : null;
}
export const PLUGIN_MAX_ZIP_SIZE = 10 * 1024 * 1024;
export function extensionMaxFileSize(kind?: string): number {
  if (kind === 'bundle') return 100 * 1024 * 1024;
  if (kind === 'plugin') return 50 * 1024 * 1024;
  return 5 * 1024 * 1024;
}
export function isPathWithinExtensionBase(filePath: string, baseDir: string): boolean {
  return path.resolve(filePath).startsWith(path.resolve(baseDir));
}
const fail = (code: string): never => { throw new PackageVerificationError(code); };
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => comparePath(a, b))
      .map(([key, item]) => [key, stable(item)]));
  }
  return value;
}
const canonical = (value: unknown) => Buffer.from(JSON.stringify(stable(value)));
const payload = (domain: string, value: unknown) => Buffer.concat([Buffer.from(domain), canonical(value)]);
const comparePath = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const base64url = (value: string): Buffer => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.toString('base64url') !== value) throw new Error('Invalid base64url');
  return bytes;
};
const publicKey = (value: string) => {
  const key = createPublicKey({ key: base64url(value), format: 'der', type: 'spki' });
  if (key.asymmetricKeyType !== 'ed25519' || key.export({ format: 'der', type: 'spki' }).toString('base64url') !== value) throw new Error('Invalid Ed25519 key');
  return key;
};

export function certificatePayload(certificate: Omit<PublisherCertificate, 'rootSignature'>): Buffer {
  return payload(CERT_DOMAIN, certificate);
}
export function packagePayload(files: PackageSignature['files']): Buffer {
  return payload(PACKAGE_DOMAIN, { schemaVersion: 1, algorithm: 'Ed25519', files });
}
export function issuePublisherCertificate(
  publisherId: string, publisherName: string, publisherPublicKey: string, rootPrivateKeyPem: string,
): PublisherCertificate {
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(publisherId) || !publisherName.trim() || publisherName !== publisherName.normalize('NFC')) throw new Error('Invalid publisher identity');
  publicKey(publisherPublicKey);
  const unsigned = { schemaVersion: 1 as const, publisherId, publisherName, algorithm: 'Ed25519' as const, publicKey: publisherPublicKey };
  return { ...unsigned, rootSignature: sign(null, certificatePayload(unsigned), createPrivateKey(rootPrivateKeyPem)).toString('base64url') };
}
export function signPackage(files: PackageSignature['files'], publisherPrivateKeyPem: string): PackageSignature {
  return { schemaVersion: 1, algorithm: 'Ed25519', files, signature: sign(null, packagePayload(files), createPrivateKey(publisherPrivateKeyPem)).toString('base64url') };
}
export function assertTestRootEnvironment(
  mode = process.env.EXTENSION_TEST_SIGNING_MODE === 'true',
  testRoot = process.env.JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY,
): void {
  const overrideFlag = process.env.JIFFOO_TEST_OFFICIAL_ROOT_OVERRIDE;
  const overrideKey = process.env.JIFFOO_TEST_OFFICIAL_ROOT_PUBLIC_KEY;
  if (process.env.NODE_ENV !== 'test' && (overrideFlag !== undefined || overrideKey !== undefined)) {
    throw new Error('Official root override is allowed only under NODE_ENV=test');
  }
  if (overrideFlag !== undefined && overrideFlag !== 'true') throw new Error('JIFFOO_TEST_OFFICIAL_ROOT_OVERRIDE must be true when set');
  if (overrideFlag === 'true') {
    if (!overrideKey || overrideKey === testRoot) throw new Error('Official root override requires a distinct substitute public key');
    try { publicKey(overrideKey); } catch { throw new Error('Official root override requires a valid Ed25519 public key'); }
  } else if (overrideKey !== undefined) {
    throw new Error('Official root override key requires JIFFOO_TEST_OFFICIAL_ROOT_OVERRIDE=true');
  }
  if (!mode && testRoot) throw new Error('JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY requires EXTENSION_TEST_SIGNING_MODE=true');
  if (mode) {
    if (!testRoot || testRoot === OFFICIAL_ROOT_PUBLIC_KEY) throw new Error('EXTENSION_TEST_SIGNING_MODE requires a distinct test root public key');
    try { publicKey(testRoot); } catch { throw new Error('EXTENSION_TEST_SIGNING_MODE requires a valid Ed25519 test root public key'); }
  }
}
export function trustedRootKeys(): Array<{ key: string; kind: 'official' | 'test' }> {
  const mode = process.env.EXTENSION_TEST_SIGNING_MODE === 'true';
  const testRoot = process.env.JIFFOO_TEST_PLUGIN_ROOT_PUBLIC_KEY;
  assertTestRootEnvironment(mode, testRoot);
  const officialKey = process.env.NODE_ENV === 'test' &&
    process.env.JIFFOO_TEST_OFFICIAL_ROOT_OVERRIDE === 'true'
    ? process.env.JIFFOO_TEST_OFFICIAL_ROOT_PUBLIC_KEY!
    : OFFICIAL_ROOT_PUBLIC_KEY;
  return mode && testRoot
    ? [{ key: officialKey, kind: 'official' }, { key: testRoot, kind: 'test' }]
    : [{ key: officialKey, kind: 'official' }];
}

export type PluginZipEntry = { path: string; content: Buffer; flags: number; mode: number };
type ZipEntry = PluginZipEntry;
function rawEntries(zip: Buffer): ZipEntry[] {
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50 && i + 22 + zip.readUInt16LE(i + 20) === zip.length) { end = i; break; }
  }
  if (end < 0 || zip.readUInt16LE(end + 4) || zip.readUInt16LE(end + 6)) throw new Error('Invalid ZIP directory');
  const count = zip.readUInt16LE(end + 10);
  const offset = zip.readUInt32LE(end + 16);
  const size = zip.readUInt32LE(end + 12);
  if (offset + size > end) throw new Error('Invalid ZIP directory');
  const entries: ZipEntry[] = [];
  let cursor = offset;
  for (let n = 0; n < count; n++) {
    if (cursor + 46 > zip.length || zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP entry');
    const flags = zip.readUInt16LE(cursor + 8);
    const method = zip.readUInt16LE(cursor + 10);
    const compressed = zip.readUInt32LE(cursor + 20);
    const uncompressed = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const mode = zip.readUInt32LE(cursor + 38) >>> 16;
    const localOffset = zip.readUInt32LE(cursor + 42);
    if (cursor + 46 + nameLength + extraLength + commentLength > zip.length) throw new Error('Invalid ZIP entry');
    const name = decoder.decode(zip.subarray(cursor + 46, cursor + 46 + nameLength));
    if (localOffset + 30 > zip.length || zip.readUInt32LE(localOffset) !== 0x04034b50) fail('PACKAGE_CONTENT_MISMATCH');
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    if (decoder.decode(zip.subarray(localOffset + 30, localOffset + 30 + localNameLength)) !== name) fail('PACKAGE_CONTENT_MISMATCH');
    const start = localOffset + 30 + localNameLength + localExtraLength;
    if (start + compressed > zip.length) fail('PACKAGE_CONTENT_MISMATCH');
    const bytes = zip.subarray(start, start + compressed);
    let content!: Buffer;
    try { content = method === 0 ? bytes : method === 8 ? inflateRawSync(bytes) : fail('PACKAGE_CONTENT_MISMATCH'); }
    catch { fail('PACKAGE_CONTENT_MISMATCH'); }
    if (content.length !== uncompressed) fail('PACKAGE_CONTENT_MISMATCH');
    entries.push({ path: name, content, flags, mode });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor !== offset + size) throw new Error('Invalid ZIP directory');
  return entries;
}

export async function verifyPluginZip(filePath: string): Promise<PublisherIdentity | null> {
  const zip = await readFile(filePath);
  let entries: ZipEntry[];
  try { entries = rawEntries(zip); } catch (error) {
    if (error instanceof PackageVerificationError) throw error;
    throw new Error('ZIP parsing failed');
  }
  const cert = entries.find((entry) => entry.path === CERT_PATH);
  const sig = entries.find((entry) => entry.path === SIGNATURE_PATH);
  if (entries.some((entry) => entry.path.endsWith(`/${CERT_PATH}`) || entry.path.endsWith(`/${SIGNATURE_PATH}`))) fail('PACKAGE_CONTENT_MISMATCH');
  if (!cert && !sig) return null;
  if (!cert || !sig) fail('INCOMPLETE_PACKAGE_SIGNATURE');
  validatePluginZipPaths(entries);
  const { certificate, signingRoot } = verifyPublisherCertificateWithRoot(cert!.content);
  let signature: PackageSignature;
  try {
    signature = JSON.parse(decoder.decode(sig!.content));
    if (signature.schemaVersion !== 1 || signature.algorithm !== 'Ed25519' || !Array.isArray(signature.files) ||
      typeof signature.signature !== 'string' ||
      Object.keys(signature).sort().join(',') !== 'algorithm,files,schemaVersion,signature') fail('INVALID_PACKAGE_SIGNATURE');
    base64url(signature.signature);
  } catch { fail('INVALID_PACKAGE_SIGNATURE'); }
  const actual = entries.filter((entry) => entry.path !== SIGNATURE_PATH).map((entry) => ({ path: entry.path, sha256: hash(entry.content) }))
    .sort((a, b) => comparePath(a.path, b.path));
  if (!actual.some((file) => file.path === 'manifest.json') || signature!.files.length !== actual.length ||
    signature!.files.some((file, index) => typeof file?.path !== 'string' || typeof file?.sha256 !== 'string' ||
      file.path !== actual[index].path || file.sha256 !== actual[index].sha256 ||
      Object.keys(file).sort().join(',') !== 'path,sha256')) fail('PACKAGE_CONTENT_MISMATCH');
  if (!verify(null, packagePayload(signature!.files), publicKey(certificate.publicKey), base64url(signature!.signature))) fail('INVALID_PACKAGE_SIGNATURE');
  return { publisherId: certificate.publisherId, publisherName: certificate.publisherName, publisherCertificateFingerprint: hash(cert!.content), signingRoot };
}

export function validatePluginZipPaths(entries: PluginZipEntry[]): void {
  const names = new Set<string>();
  const folded = new Set<string>();
  for (const entry of entries) {
    const name = entry.path;
    if (!name || name !== name.normalize('NFC') || name.includes('\\') || name.includes('\0') ||
      /^[A-Za-z]:/.test(name) || name.startsWith('/') || name.split('/').some((part) => !part || part === '.' || part === '..') ||
      name.endsWith('/') || (!(entry.flags & 0x800) && /[^\x00-\x7f]/.test(name)) || entry.flags & 1 ||
      (entry.mode && (entry.mode & 0xf000) !== 0x8000) ||
      names.has(name) || folded.has(name.toLowerCase())) fail('PACKAGE_CONTENT_MISMATCH');
    names.add(name);
    folded.add(name.toLowerCase());
  }
}

export function readPluginZipEntries(zip: Buffer): PluginZipEntry[] {
  const entries = rawEntries(zip);
  validatePluginZipPaths(entries);
  return entries;
}

export function verifyPublisherCertificate(bytes: Buffer): PublisherCertificate {
  return verifyPublisherCertificateWithRoot(bytes).certificate;
}

export function verifyPublisherCertificateWithRoot(bytes: Buffer): {
  certificate: PublisherCertificate; signingRoot: 'official' | 'test';
} {
  let certificate: PublisherCertificate;
  try {
    certificate = JSON.parse(decoder.decode(bytes));
    if (certificate.schemaVersion !== 1 || certificate.algorithm !== 'Ed25519' ||
      !/^[a-z][a-z0-9-]{1,63}$/.test(certificate.publisherId) || !certificate.publisherName?.trim() ||
      certificate.publisherName !== certificate.publisherName.normalize('NFC') ||
      typeof certificate.publicKey !== 'string' || typeof certificate.rootSignature !== 'string' ||
      Object.keys(certificate).sort().join(',') !== 'algorithm,publicKey,publisherId,publisherName,rootSignature,schemaVersion') fail('INVALID_PUBLISHER_CERTIFICATE');
    publicKey(certificate.publicKey);
    base64url(certificate.rootSignature);
  } catch { fail('INVALID_PUBLISHER_CERTIFICATE'); }
  const { rootSignature, ...unsigned } = certificate!;
  const root = trustedRootKeys().find(({ key }) => {
    try { return verify(null, certificatePayload(unsigned), publicKey(key), base64url(rootSignature)); } catch { return false; }
  });
  if (!root) fail('UNTRUSTED_PUBLISHER_CERTIFICATE');
  return { certificate: certificate!, signingRoot: root!.kind };
}

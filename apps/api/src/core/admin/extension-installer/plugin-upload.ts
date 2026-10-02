import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { PluginInstall } from '@prisma/client';
import { prisma } from '@/config/database';
import { env } from '@/config/env';
import { PLUGIN_MAX_ZIP_SIZE, readPluginZipEntries, verifyPluginZip } from 'shared/plugin-signing';
import { validateFileExtension, validateFileSize } from './security';
import { validatePluginManifest } from './utils';
import { checkPluginApiCompatibility } from './plugin-compatibility';
import { compareVersions } from './version-utils';
import type { PluginManifest } from './types';
import { writePluginAudit } from './plugin-audit';

export class PluginUploadError extends Error {
  constructor(public readonly code: string, public readonly statusCode: number, message = code) { super(message); }
}
export type UploadSnapshot = { id: string; hash: string | null; updatedAt: string; deletedAt: string | null } | null;
export type UploadInspection = Awaited<ReturnType<typeof inspectPluginUpload>>;
type PreviewPayload = {
  schemaVersion: 1; actorId: string; action: 'plugin.local-upload';
  hash: string; slug: string; version: string; trust: 'signed' | 'unsigned';
  snapshot: UploadSnapshot; expiresAt: number;
};
type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export function uploadSnapshot(current: PluginInstall | null): UploadSnapshot {
  return current ? { id: current.id, hash: current.zipHash, updatedAt: current.updatedAt.toISOString(), deletedAt: current.deletedAt?.toISOString() ?? null } : null;
}

export async function inspectPluginUpload(bytes: Buffer) {
  if (bytes.length > PLUGIN_MAX_ZIP_SIZE) throw new PluginUploadError('PAYLOAD_TOO_LARGE', 413);
  let publisher: Awaited<ReturnType<typeof verifyPluginZip>>;
  let entries: ReturnType<typeof readPluginZipEntries>;
  try {
    publisher = await verifyPluginZip(bytes);
    entries = readPluginZipEntries(bytes, publisher === null);
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    throw new PluginUploadError('INVALID_PLUGIN_ARCHIVE', 400, 'Invalid plugin ZIP archive');
  }
  for (const entry of entries) {
    if (entry.path.endsWith('/')) continue;
    validateFileExtension(entry.path, 'plugin');
    validateFileSize(entry.path, entry.content.length, 'plugin');
  }
  const rootManifest = entries.find((entry) => entry.path === 'manifest.json');
  const topFolders = new Set(entries.map((entry) => entry.path.split('/')[0]).filter((name) => !name.startsWith('.') && name !== '__MACOSX'));
  const wrapped = entries.filter((entry) => /^[^/]+\/manifest\.json$/.test(entry.path));
  const manifestEntry = rootManifest ?? (topFolders.size === 1 && wrapped.length === 1 ? wrapped[0] : undefined);
  if (!manifestEntry) throw new PluginUploadError('BAD_REQUEST', 400, 'ZIP requires one plugin manifest.json');
  let manifest: PluginManifest;
  try { manifest = JSON.parse(manifestEntry.content.toString('utf8')); }
  catch { throw new PluginUploadError('INVALID_JSON', 400, 'Invalid manifest.json'); }
  validatePluginManifest(manifest);
  if (['manual-payment', 'free-shipping', 'zero-tax', 'manual-fulfillment', 'console-email'].includes(manifest.slug))
    throw new PluginUploadError('SLUG_RESERVED', 400);
  return { manifest, publisher, hash: createHash('sha256').update(bytes).digest('hex'), trust: publisher ? 'signed' as const : 'unsigned' as const };
}

export function uploadOperation(inspection: UploadInspection, current: PluginInstall | null): 'install' | 'upgrade' | 'unchanged' {
  if (current?.trustLevel === 'signed' && !inspection.publisher)
    throw new PluginUploadError('SIGNED_UPGRADE_REQUIRED', 409);
  if (current?.publisherId && inspection.publisher && current.publisherId !== inspection.publisher.publisherId)
    throw new PluginUploadError('PUBLISHER_CHANGE_FORBIDDEN', 409);
  if (!current) return 'install';
  const comparison = compareVersions(inspection.manifest.version, current.version);
  if (comparison < 0) throw new PluginUploadError('PLUGIN_DOWNGRADE_NOT_SUPPORTED', 409, 'Downgrade is not supported');
  if (comparison === 0 && inspection.hash !== current.zipHash)
    throw new PluginUploadError('PLUGIN_VERSION_CONTENT_CHANGED', 409, 'Package content changed; increase the version');
  if (current.deletedAt) return 'install';
  return comparison === 0 ? 'unchanged' : 'upgrade';
}

function previewKey() {
  return createHmac('sha256', env.JWT_SECRET).update('jiffoo-core/plugin-upload-preview/key/v1').digest();
}
function mac(body: string) {
  return createHmac('sha256', previewKey()).update('jiffoo-core/plugin-upload-preview/token/v1\0').update(body).digest();
}

export async function previewPluginUpload(bytes: Buffer, actorId: string) {
  const inspection = await inspectPluginUpload(bytes);
  const current = await prisma.pluginInstall.findUnique({ where: { slug: inspection.manifest.slug } });
  const operation = uploadOperation(inspection, current);
  const compatibility = checkPluginApiCompatibility(inspection.manifest);
  const expiresAt = Date.now() + 5 * 60_000;
  const payload: PreviewPayload = {
    schemaVersion: 1, actorId, action: 'plugin.local-upload', hash: inspection.hash,
    slug: inspection.manifest.slug, version: inspection.manifest.version, trust: inspection.trust,
    snapshot: uploadSnapshot(current), expiresAt,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return {
    package: { slug: inspection.manifest.slug, name: inspection.manifest.name, version: inspection.manifest.version, hash: inspection.hash,
      trust: inspection.trust, publisher: inspection.publisher, declaredCapabilities: inspection.manifest.contracts?.map((contract) => contract.name) ?? [] },
    current: { version: current?.version ?? null, hash: current?.zipHash ?? null, state: current ? current.deletedAt ? 'uninstalled' : 'installed' : 'not-installed' },
    operation, compatibility, requiresUnsignedConfirmation: inspection.trust === 'unsigned', expiresAt: new Date(expiresAt).toISOString(),
    previewToken: `${body}.${mac(body).toString('base64url')}`,
  };
}

export function assertUploadPreview(token: string | undefined, actorId: string | undefined, inspection: UploadInspection, current: PluginInstall | null): UploadSnapshot {
  const invalid = () => new PluginUploadError('PLUGIN_PREVIEW_REQUIRED', 409, 'Preview expired or changed; preview the ZIP again');
  if (!token || !actorId || token.length > 8192) throw invalid();
  try {
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra) throw invalid();
    const actual = Buffer.from(signature, 'base64url'), expected = mac(body);
    if (actual.toString('base64url') !== signature || Buffer.from(body, 'base64url').toString('base64url') !== body) throw invalid();
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalid();
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as PreviewPayload;
    if (payload.schemaVersion !== 1 || payload.actorId !== actorId || payload.action !== 'plugin.local-upload'
      || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()
      || payload.hash !== inspection.hash || payload.slug !== inspection.manifest.slug || payload.version !== inspection.manifest.version
      || payload.trust !== inspection.trust || !isDeepStrictEqual(payload.snapshot, uploadSnapshot(current))) throw invalid();
    return payload.snapshot;
  } catch { throw invalid(); }
}

export async function assertUploadSnapshot(tx: Transaction, slug: string, snapshot: UploadSnapshot) {
  const current = await tx.pluginInstall.findUnique({ where: { slug } });
  if (!isDeepStrictEqual(snapshot, uploadSnapshot(current)))
    throw new PluginUploadError('PLUGIN_PREVIEW_REQUIRED', 409, 'Installation changed; preview the ZIP again');
}

export async function writePluginInstallAudit(tx: Transaction, actorId: string, action: string, inspection: UploadInspection, operation: string, previousVersion: string | null, source = 'local-zip') {
  await writePluginAudit(tx, actorId, action, inspection.manifest.slug,
    { slug: inspection.manifest.slug, source, version: inspection.manifest.version, previousVersion, hash: inspection.hash, trust: inspection.trust,
      publisherId: inspection.publisher?.publisherId ?? null, signingRoot: inspection.publisher?.signingRoot ?? null, operation });
}

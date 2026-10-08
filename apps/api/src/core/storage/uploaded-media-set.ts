import { createHash } from 'node:crypto';
import { z } from 'zod';
import { uploadedObjectStore, type UploadedObjectStore } from './uploaded-object-store';
import { ApiError } from '@/utils/api-errors';

export const mediaKeyPattern = /^(products|avatars)\/([a-f0-9]{64})\/((?:original|thumb|medium|large)\.(?:jpg|png|webp))$/;
const fileSchema = z.object({ name: z.string().regex(/^(?:original|thumb|medium|large)\.(?:jpg|png|webp)$/),
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']), size: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const manifestSchema = z.object({ files: z.array(fileSchema).min(1).max(8) }).strict();
export type MediaFile = { name: string; mime: 'image/jpeg' | 'image/png' | 'image/webp'; content: Buffer };
export const mediaSha256 = (content: Buffer): string => createHash('sha256').update(content).digest('hex');

export async function publishMediaSet(kind: 'products' | 'avatars', files: MediaFile[], store: UploadedObjectStore = uploadedObjectStore): Promise<string> {
  const sorted = [...files].sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const manifest = Buffer.from(JSON.stringify({ files: sorted.map(file => ({ name: file.name, mime: file.mime,
    size: file.content.length, sha256: mediaSha256(file.content) })) }));
  const hash = mediaSha256(manifest);
  for (const file of sorted) await store.put(`${kind}/${hash}/${file.name}`, file.content, file.mime);
  // Publishing this object last makes incomplete sets inaccessible through the API.
  await store.put(`${kind}/${hash}/manifest.json`, manifest, 'application/json');
  return hash;
}

export async function readMediaFile(key: string, store: UploadedObjectStore = uploadedObjectStore): Promise<{ content: Buffer; mime: string; sha256: string } | null> {
  const match = mediaKeyPattern.exec(key);
  if (!match) return null;
  const [, kind, hash, name] = match;
  const manifestMetadata = await store.head(`${kind}/${hash}/manifest.json`);
  if (!manifestMetadata) return null;
  if (manifestMetadata.size > 8192) throw new ApiError('UPLOAD_STORAGE_CORRUPT');
  const manifestBytes = await store.get(`${kind}/${hash}/manifest.json`);
  if (!manifestBytes) return null;
  const corrupt = () => new ApiError('UPLOAD_STORAGE_CORRUPT');
  if (manifestBytes.length > 8192 || mediaSha256(manifestBytes) !== hash) throw corrupt();
  let parsed;
  try { parsed = manifestSchema.parse(JSON.parse(manifestBytes.toString('utf8'))); } catch { throw corrupt(); }
  const names = parsed.files.map(file => file.name);
  if (new Set(names).size !== names.length || names.join() !== [...names].sort().join()) throw corrupt();
  for (const file of parsed.files) {
    const extension = file.name.split('.').at(-1);
    if (file.mime !== ({ jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as Record<string, string>)[extension!]) throw corrupt();
  }
  const entry = parsed.files.find(file => file.name === name);
  if (!entry) return null;
  const metadata = await store.head(key);
  if (!metadata || metadata.size !== entry.size) throw corrupt();
  const content = await store.get(key);
  if (!content || content.length !== entry.size || mediaSha256(content) !== entry.sha256) throw corrupt();
  return { content, mime: entry.mime, sha256: entry.sha256 };
}

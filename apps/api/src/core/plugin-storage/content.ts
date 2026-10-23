import sharp from 'sharp';
import { ApiError } from '@/utils/api-errors';

export const fileTypes = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf', 'text/plain': 'txt' } as const;
export type FileType = keyof typeof fileTypes;

/** Reject active formats even when the caller labels them as text. */
export async function validateFileContent(content: Buffer, type: string): Promise<void> {
  if (!Object.hasOwn(fileTypes, type) || !content.length) throw new ApiError('FORBIDDEN_FILE_TYPE');
  if (type.startsWith('image/')) {
    const format = type.slice(6);
    const signature = format === 'png' ? content.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
      : format === 'jpeg' ? content[0] === 255 && content[1] === 216 && content[2] === 255
      : content.toString('ascii', 0, 4) === 'RIFF' && content.toString('ascii', 8, 12) === 'WEBP';
    if (!signature) throw new ApiError('FORBIDDEN_FILE_TYPE');
    try {
      const metadata = await sharp(content, { limitInputPixels: 40_000_000, failOn: 'warning' }).metadata();
      if (metadata.format !== format) throw new Error('MIME mismatch');
      await sharp(content, { limitInputPixels: 40_000_000, failOn: 'warning' }).stats();
    } catch { throw new ApiError('FORBIDDEN_FILE_TYPE'); }
  } else if (type === 'application/pdf') {
    if (!/^%PDF-1\.[0-7]|^%PDF-2\.0/.test(content.toString('ascii', 0, 8)) || !/%%EOF\s*$/.test(content.subarray(-1024).toString('ascii'))
      || /\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA)\b/i.test(content.toString('latin1'))) throw new ApiError('FORBIDDEN_FILE_TYPE');
  } else {
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(content); }
    catch { throw new ApiError('FORBIDDEN_FILE_TYPE'); }
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text) || /<\s*(?:!doctype|\/?[a-z][\w:-]*\b)|^\s*(?:#!|MZ|\x7fELF)/i.test(text)) throw new ApiError('FORBIDDEN_FILE_TYPE');
  }
}

/** Abort bounds the caller even if a remote provider ignores cancellation. */
export async function untilAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void work.catch(() => undefined); signal.throwIfAborted(); }
  let abort!: () => void;
  const cancelled = new Promise<never>((_resolve, reject) => { abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true }); });
  try { return await Promise.race([work, cancelled]); }
  finally { signal.removeEventListener('abort', abort); }
}

export async function collectFile(content: Uint8Array | AsyncIterable<Uint8Array>, maxBytes: number, signal: AbortSignal): Promise<Buffer> {
  signal.throwIfAborted();
  if (content instanceof Uint8Array) {
    if (content.byteLength > maxBytes) throw new ApiError('PAYLOAD_TOO_LARGE');
    return Buffer.from(content);
  }
  if (!content || typeof content[Symbol.asyncIterator] !== 'function') throw new ApiError('VALIDATION_ERROR');
  const iterator = content[Symbol.asyncIterator]();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await untilAbort(iterator.next(), signal);
      if (next.done) break;
      if (!(next.value instanceof Uint8Array)) throw new ApiError('VALIDATION_ERROR');
      size += next.value.byteLength;
      if (size > maxBytes) throw new ApiError('PAYLOAD_TOO_LARGE');
      chunks.push(Buffer.from(next.value));
    }
    return Buffer.concat(chunks, size);
  } finally { if (iterator.return) void iterator.return().catch(() => undefined); }
}

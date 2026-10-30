import type { FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { UploadService, UploadValidationError } from '@/core/upload/service';

/** The time the reader waits for the rest of an oversized body. */
const DRAIN_TIMEOUT_MS = 5000;

/**
 * Consumes the rest of the request body.
 *
 * An oversized part is refused while the client is still sending. Without the
 * drain the answer would leave the process against a half-read body, and the
 * client would see a reset instead of the answer, and the connection could
 * not be reused.
 */
async function drainRequest(request: FastifyRequest): Promise<void> {
  const raw = request.raw;
  if (raw.readableEnded || raw.destroyed) return;
  raw.resume();
  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      raw.off('end', finish);
      raw.off('close', finish);
      raw.off('error', finish);
      resolve();
    };
    const timer = setTimeout(() => { raw.destroy(); finish(); }, DRAIN_TIMEOUT_MS);
    raw.on('end', finish);
    raw.on('close', finish);
    raw.on('error', finish);
  });
}

/**
 * Reads a multipart part into memory for the upload routes.
 *
 * The framework type stays in the route layer: the upload service only ever
 * sees the neutral payload. The part is consumed through its own stream and
 * the byte budget is enforced while the stream runs, so an oversized part is
 * refused at the cap instead of being buffered first. Transport truncation is
 * reported with the same `UploadValidationError` the upload path has always
 * used, and any other failure propagates unchanged.
 */
export async function readUploadContent(request: FastifyRequest, file: MultipartFile, maxBytes: number = UploadService.MAX_FILE_SIZE): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  let overflow = false;
  try {
    for await (const chunk of file.file) {
      // An oversized part keeps no byte, but the stream is read to its end.
      if (overflow) continue;
      const buffer = chunk as Buffer;
      size += buffer.length;
      if (size > maxBytes) { overflow = true; chunks.length = 0; continue; }
      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof UploadValidationError) throw error;
    if (!file.file.truncated) throw error;
    overflow = true;
  }
  if (overflow || file.file.truncated) {
    chunks.length = 0;
    // The rest of the body is consumed before the answer leaves the process.
    await drainRequest(request);
    throw new UploadValidationError('TOO_LARGE', { maxBytes });
  }
  return Buffer.concat(chunks);
}

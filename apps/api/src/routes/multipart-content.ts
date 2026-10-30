import type { MultipartFile } from '@fastify/multipart';
import { UploadService, UploadValidationError } from '@/core/upload/service';

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
export async function readUploadContent(file: MultipartFile, maxBytes: number = UploadService.MAX_FILE_SIZE): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of file.file) {
      const buffer = chunk as Buffer;
      size += buffer.length;
      if (size > maxBytes) throw new UploadValidationError('TOO_LARGE', { maxBytes });
      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof UploadValidationError) throw error;
    if (file.file.truncated) throw new UploadValidationError('TOO_LARGE', { maxBytes });
    throw error;
  }
  if (file.file.truncated) throw new UploadValidationError('TOO_LARGE', { maxBytes });
  return Buffer.concat(chunks);
}

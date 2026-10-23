import type { MultipartFile } from '@fastify/multipart';
import { UploadService, UploadValidationError } from '@/core/upload/service';

/**
 * Reads a multipart part into memory for the upload routes.
 *
 * The framework type stays in the route layer: the upload service only ever
 * sees the neutral payload. Transport truncation is reported with the same
 * `UploadValidationError` the upload path has always used, and any other
 * failure propagates unchanged.
 */
export async function readUploadContent(file: MultipartFile): Promise<Buffer> {
  let content: Buffer;
  try { content = await file.toBuffer(); }
  catch (error) {
    if (file.file.truncated) throw new UploadValidationError('TOO_LARGE', { maxBytes: UploadService.MAX_FILE_SIZE });
    throw error;
  }
  if (file.file.truncated) throw new UploadValidationError('TOO_LARGE', { maxBytes: UploadService.MAX_FILE_SIZE });
  return content;
}

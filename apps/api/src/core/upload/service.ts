import { MultipartFile } from '@fastify/multipart';
import { publishMediaSet, type MediaFile } from '@/core/storage/uploaded-media-set';

export class UploadValidationError extends Error {
  constructor(readonly reason: 'INVALID_TYPE' | 'TOO_LARGE', readonly details: { allowedTypes?: string[]; maxBytes?: number }) {
    super(reason === 'INVALID_TYPE' ? 'Invalid file type' : 'File too large');
    this.name = 'UploadValidationError';
  }
}

export interface UploadResult { filename: string; originalName: string; size: number; mimetype: string; url: string }

export class UploadService {
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024;
  private static readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  private static sharpModule: any | null | undefined;

  private static invalidType(): UploadValidationError {
    return new UploadValidationError('INVALID_TYPE', { allowedTypes: [...this.ALLOWED_TYPES] });
  }
  private static async readImageBuffer(file: MultipartFile): Promise<Buffer> {
    if (!this.ALLOWED_TYPES.includes(file.mimetype)) throw this.invalidType();
    let buffer: Buffer;
    try { buffer = await file.toBuffer(); }
    catch (error) {
      if (file.file.truncated) throw new UploadValidationError('TOO_LARGE', { maxBytes: this.MAX_FILE_SIZE });
      throw error;
    }
    if (file.file.truncated || buffer.length > this.MAX_FILE_SIZE) throw new UploadValidationError('TOO_LARGE', { maxBytes: this.MAX_FILE_SIZE });
    return buffer;
  }
  private static getSharp(): any | null {
    if (this.sharpModule !== undefined) return this.sharpModule;
    try { this.sharpModule = require('sharp'); }
    catch (error) {
      this.sharpModule = null;
      console.warn('[UploadService] sharp unavailable; preserving the detected original format', error instanceof Error ? error.message : String(error));
    }
    return this.sharpModule;
  }
  private static detect(buffer: Buffer): { extension: string; mime: MediaFile['mime'] } {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { extension: 'jpg', mime: 'image/jpeg' };
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { extension: 'png', mime: 'image/png' };
    if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { extension: 'webp', mime: 'image/webp' };
    throw this.invalidType();
  }
  private static async upload(file: MultipartFile, kind: 'products' | 'avatars'): Promise<UploadResult> {
    const buffer = await this.readImageBuffer(file);
    const detected = this.detect(buffer);
    const sharp = this.getSharp();
    const sizes = kind === 'avatars' ? [{ name: 'original', width: 200, height: 200 }]
      : [{ name: 'original', width: 0, height: 0 }, { name: 'thumb', width: 150, height: 150 },
        { name: 'medium', width: 500, height: 500 }, { name: 'large', width: 1200, height: 1200 }];
    const files: MediaFile[] = [];
    if (sharp) {
      try {
        const metadata = await sharp(buffer).metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format)) throw this.invalidType();
        for (const size of sizes) {
          for (const format of ['jpg', 'webp'] as const) {
            let image = sharp(buffer);
            if (size.width) image = image.resize(size.width, size.height, { fit: 'cover', position: 'center' });
            const content = await (format === 'jpg' ? image.jpeg({ quality: 85 }) : image.webp({ quality: 85 })).toBuffer();
            files.push({ name: `${size.name}.${format}`, mime: format === 'jpg' ? 'image/jpeg' : 'image/webp', content });
          }
        }
      } catch (error) {
        if (error instanceof UploadValidationError) throw error;
        throw this.invalidType();
      }
    } else {
      for (const size of sizes) files.push({ name: `${size.name}.${detected.extension}`, mime: detected.mime, content: buffer });
    }
    const hash = await publishMediaSet(kind, files);
    const original = files[0];
    return { filename: original.name, originalName: file.filename || 'unknown', size: original.content.length,
      mimetype: original.mime, url: `/uploads/${kind}/${hash}/${original.name}` };
  }
  static uploadProductImage(file: MultipartFile): Promise<UploadResult> { return this.upload(file, 'products'); }
  static uploadAvatar(file: MultipartFile): Promise<UploadResult> { return this.upload(file, 'avatars'); }
}

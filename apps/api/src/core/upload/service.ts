
import { MultipartFile } from '@fastify/multipart';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { CDNConfig } from '../performance/cdn-config';

export interface UploadResult {
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  url: string;
}

export class UploadService {
  private static readonly UPLOAD_DIR = 'uploads';
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  private static sharpModule: any | null | undefined;
  private static sharpUnavailableReason: string | null = null;
  private static readonly IMAGE_SIZES = {
    thumbnail: { width: 150, height: 150 },
    medium: { width: 500, height: 500 },
    large: { width: 1200, height: 1200 }
  };

  static async uploadProductImage(file: MultipartFile): Promise<UploadResult> {
    // Validate file type
    if (!this.ALLOWED_TYPES.includes(file.mimetype)) {
      throw new Error(`Invalid file type. Allowed types: ${this.ALLOWED_TYPES.join(', ')}`);
    }

    // Validate file size
    const buffer = await file.toBuffer();
    if (buffer.length > this.MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size: ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const fileId = randomUUID();
    const ext = path.extname(file.filename || '.jpg');
    const baseFilename = `${fileId}${ext}`;
    const webpFilename = `${fileId}.webp`;

    const productDir = path.join(this.UPLOAD_DIR, 'products');
    await this.ensureDirectoryExists(productDir);

    // Generate different sizes of images in both JPEG and WebP formats
    await Promise.all([
      // JPEG versions
      this.processImage(buffer, path.join(productDir, `thumb_${baseFilename}`), this.IMAGE_SIZES.thumbnail),
      this.processImage(buffer, path.join(productDir, `medium_${baseFilename}`), this.IMAGE_SIZES.medium),
      this.processImage(buffer, path.join(productDir, `large_${baseFilename}`), this.IMAGE_SIZES.large),
      this.processImage(buffer, path.join(productDir, baseFilename)), // Original image
      // WebP versions
      this.processWebP(buffer, path.join(productDir, `thumb_${webpFilename}`), this.IMAGE_SIZES.thumbnail),
      this.processWebP(buffer, path.join(productDir, `medium_${webpFilename}`), this.IMAGE_SIZES.medium),
      this.processWebP(buffer, path.join(productDir, `large_${webpFilename}`), this.IMAGE_SIZES.large),
      this.processWebP(buffer, path.join(productDir, webpFilename)) // Original WebP
    ]);

    const localUrl = `/uploads/products/${baseFilename}`;
    const url = CDNConfig.getAssetUrl(localUrl);

    return {
      filename: baseFilename,
      originalName: file.filename || 'unknown',
      size: buffer.length,
      mimetype: file.mimetype,
      url
    };
  }

  static async uploadAvatar(file: MultipartFile): Promise<UploadResult> {
    // Validate file type
    if (!this.ALLOWED_TYPES.includes(file.mimetype)) {
      throw new Error(`Invalid file type. Allowed types: ${this.ALLOWED_TYPES.join(', ')}`);
    }

    const buffer = await file.toBuffer();
    if (buffer.length > this.MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size: ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const fileId = randomUUID();
    const ext = path.extname(file.filename || '.jpg');
    const filename = `${fileId}${ext}`;
    const webpFilename = `${fileId}.webp`;

    const avatarDir = path.join(this.UPLOAD_DIR, 'avatars');
    await this.ensureDirectoryExists(avatarDir);

    // Avatars only need one size, generate both JPEG and WebP
    await Promise.all([
      this.processImage(buffer, path.join(avatarDir, filename), { width: 200, height: 200 }),
      this.processWebP(buffer, path.join(avatarDir, webpFilename), { width: 200, height: 200 })
    ]);

    const localUrl = `/uploads/avatars/${filename}`;
    const url = CDNConfig.getAssetUrl(localUrl);

    return {
      filename,
      originalName: file.filename || 'unknown',
      size: buffer.length,
      mimetype: file.mimetype,
      url
    };
  }

  private static async processImage(
    buffer: Buffer,
    outputPath: string,
    size?: { width: number; height: number }
  ): Promise<void> {
    const sharp = this.getSharp();
    if (!sharp) {
      await fs.writeFile(outputPath, buffer);
      return;
    }

    let sharpInstance = sharp(buffer);

    if (size) {
      sharpInstance = sharpInstance.resize(size.width, size.height, {
        fit: 'cover',
        position: 'center'
      });
    }

    await sharpInstance
      .jpeg({ quality: 85 })
      .toFile(outputPath);
  }

  private static async processWebP(
    buffer: Buffer,
    outputPath: string,
    size?: { width: number; height: number }
  ): Promise<void> {
    const sharp = this.getSharp();
    if (!sharp) {
      // Without sharp we cannot reliably transcode to WebP.
      if (path.extname(outputPath) === '.webp' && this.isWebP(buffer)) {
        await fs.writeFile(outputPath, buffer);
      }
      return;
    }

    let sharpInstance = sharp(buffer);

    if (size) {
      sharpInstance = sharpInstance.resize(size.width, size.height, {
        fit: 'cover',
        position: 'center'
      });
    }

    await sharpInstance
      .webp({ quality: 85 })
      .toFile(outputPath);
  }

  private static getSharp(): any | null {
    if (this.sharpModule !== undefined) {
      return this.sharpModule;
    }

    try {
      // Load sharp lazily so unsupported CPUs do not crash the entire API process.
      // Uploads fall back to storing the original image when sharp is unavailable.
       
      this.sharpModule = require('sharp');
      return this.sharpModule;
    } catch (error) {
      this.sharpModule = null;
      this.sharpUnavailableReason = error instanceof Error ? error.message : String(error);
      console.warn('[UploadService] sharp unavailable, falling back to raw image writes:', this.sharpUnavailableReason);
      return null;
    }
  }

  private static isWebP(buffer: Buffer): boolean {
    if (buffer.length < 12) {
      return false;
    }

    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }

  private static async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  static async deleteFile(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.UPLOAD_DIR, filePath);

      // Check if file exists
      try {
        await fs.access(fullPath);
      } catch {
        throw new Error('File not found');
      }

      await fs.unlink(fullPath);

      // Delete related thumbnails and WebP versions
      const dir = path.dirname(fullPath);
      const filename = path.basename(fullPath);
      const fileWithoutExt = filename.replace(/\.[^/.]+$/, '');
      const relatedFiles = [
        // JPEG versions
        path.join(dir, `thumb_${filename}`),
        path.join(dir, `medium_${filename}`),
        path.join(dir, `large_${filename}`),
        // WebP versions
        path.join(dir, `${fileWithoutExt}.webp`),
        path.join(dir, `thumb_${fileWithoutExt}.webp`),
        path.join(dir, `medium_${fileWithoutExt}.webp`),
        path.join(dir, `large_${fileWithoutExt}.webp`)
      ];

      await Promise.allSettled(
        relatedFiles.map(file => fs.unlink(file))
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'File not found') {
        throw error;
      }
      console.error('Error deleting file:', error);
      throw new Error('Delete failed');
    }
  }

  static getImageUrl(
    filename: string,
    size: 'thumbnail' | 'medium' | 'large' | 'original' = 'original',
    format: 'jpeg' | 'webp' = 'jpeg'
  ): string {
    let targetFilename = filename;

    // Convert to WebP filename if requested
    if (format === 'webp') {
      const fileWithoutExt = filename.replace(/\.[^/.]+$/, '');
      targetFilename = `${fileWithoutExt}.webp`;
    }

    let localUrl: string;
    if (size === 'original') {
      localUrl = `/uploads/products/${targetFilename}`;
    } else {
      const prefix = size === 'thumbnail' ? 'thumb_' : `${size}_`;
      localUrl = `/uploads/products/${prefix}${targetFilename}`;
    }

    // Transform to CDN URL if CDN is enabled
    return CDNConfig.getAssetUrl(localUrl);
  }
}

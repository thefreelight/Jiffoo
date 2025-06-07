import { FastifyRequest } from 'fastify';
import { MultipartFile } from '@fastify/multipart';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

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
  private static readonly IMAGE_SIZES = {
    thumbnail: { width: 150, height: 150 },
    medium: { width: 500, height: 500 },
    large: { width: 1200, height: 1200 }
  };

  static async uploadProductImage(file: MultipartFile): Promise<UploadResult> {
    // 验证文件类型
    if (!this.ALLOWED_TYPES.includes(file.mimetype)) {
      throw new Error(`Invalid file type. Allowed types: ${this.ALLOWED_TYPES.join(', ')}`);
    }

    // 验证文件大小
    const buffer = await file.toBuffer();
    if (buffer.length > this.MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size: ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const fileId = randomUUID();
    const ext = path.extname(file.filename || '.jpg');
    const baseFilename = `${fileId}${ext}`;
    
    const productDir = path.join(this.UPLOAD_DIR, 'products');
    await this.ensureDirectoryExists(productDir);

    // 生成不同尺寸的图片
    const results = await Promise.all([
      this.processImage(buffer, path.join(productDir, `thumb_${baseFilename}`), this.IMAGE_SIZES.thumbnail),
      this.processImage(buffer, path.join(productDir, `medium_${baseFilename}`), this.IMAGE_SIZES.medium),
      this.processImage(buffer, path.join(productDir, `large_${baseFilename}`), this.IMAGE_SIZES.large),
      this.processImage(buffer, path.join(productDir, baseFilename)) // 原图
    ]);

    return {
      filename: baseFilename,
      originalName: file.filename || 'unknown',
      size: buffer.length,
      mimetype: file.mimetype,
      url: `/uploads/products/${baseFilename}`
    };
  }

  static async uploadAvatar(file: MultipartFile): Promise<UploadResult> {
    // 验证文件类型
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
    
    const avatarDir = path.join(this.UPLOAD_DIR, 'avatars');
    await this.ensureDirectoryExists(avatarDir);

    // 头像只需要一个尺寸
    await this.processImage(buffer, path.join(avatarDir, filename), { width: 200, height: 200 });

    return {
      filename,
      originalName: file.filename || 'unknown',
      size: buffer.length,
      mimetype: file.mimetype,
      url: `/uploads/avatars/${filename}`
    };
  }

  private static async processImage(
    buffer: Buffer, 
    outputPath: string, 
    size?: { width: number; height: number }
  ): Promise<void> {
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
      await fs.unlink(fullPath);
      
      // 删除相关的缩略图
      const dir = path.dirname(fullPath);
      const filename = path.basename(fullPath);
      const ext = path.extname(filename);
      const baseName = path.basename(filename, ext);
      
      const relatedFiles = [
        path.join(dir, `thumb_${filename}`),
        path.join(dir, `medium_${filename}`),
        path.join(dir, `large_${filename}`)
      ];

      await Promise.allSettled(
        relatedFiles.map(file => fs.unlink(file))
      );
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }

  static getImageUrl(filename: string, size: 'thumbnail' | 'medium' | 'large' | 'original' = 'original'): string {
    if (size === 'original') {
      return `/uploads/products/${filename}`;
    }
    
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const prefix = size === 'thumbnail' ? 'thumb_' : `${size}_`;
    
    return `/uploads/products/${prefix}${filename}`;
  }
}

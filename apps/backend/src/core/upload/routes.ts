import { FastifyInstance } from 'fastify';
import { UploadService } from './service';
import { authMiddleware, adminMiddleware } from '@/core/auth/middleware';

export async function uploadRoutes(fastify: FastifyInstance) {
  // 上传商品图片 (管理员)
  fastify.post('/product-image', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['upload'],
      summary: '上传商品图片',
      description: '上传商品图片，支持 JPEG、PNG、WebP 格式，最大 5MB',
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                originalName: { type: 'string' },
                size: { type: 'number' },
                mimetype: { type: 'string' },
                url: { type: 'string' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({
          error: 'No file uploaded',
          message: 'Please select a file to upload'
        });
      }

      const result = await UploadService.uploadProductImage(data);
      
      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 上传用户头像 (认证用户)
  fastify.post('/avatar', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['upload'],
      summary: '上传用户头像',
      description: '上传用户头像，支持 JPEG、PNG、WebP 格式，最大 5MB',
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                originalName: { type: 'string' },
                size: { type: 'number' },
                mimetype: { type: 'string' },
                url: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({
          error: 'No file uploaded',
          message: 'Please select a file to upload'
        });
      }

      const result = await UploadService.uploadAvatar(data);
      
      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 删除文件 (管理员)
  fastify.delete('/file/:filename', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['upload'],
      summary: '删除文件',
      description: '删除上传的文件及其缩略图',
      params: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: '文件名' }
        },
        required: ['filename']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { filename } = request.params as { filename: string };
      
      await UploadService.deleteFile(`products/${filename}`);
      
      return reply.send({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Delete failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取图片 URL (公开)
  fastify.get('/image-url/:filename', {
    schema: {
      tags: ['upload'],
      summary: '获取图片 URL',
      description: '获取不同尺寸的图片 URL',
      params: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: '文件名' }
        },
        required: ['filename']
      },
      querystring: {
        type: 'object',
        properties: {
          size: { 
            type: 'string', 
            enum: ['thumbnail', 'medium', 'large', 'original'],
            default: 'original',
            description: '图片尺寸'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            size: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const { size = 'original' } = request.query as { size?: 'thumbnail' | 'medium' | 'large' | 'original' };
    
    const url = UploadService.getImageUrl(filename, size);
    
    return reply.send({
      url,
      size
    });
  });
}

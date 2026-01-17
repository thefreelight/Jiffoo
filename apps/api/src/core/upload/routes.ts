import { FastifyInstance } from 'fastify';
import { UploadService } from './service';
import { authMiddleware, adminMiddleware } from '@/core/auth/middleware';

export async function uploadRoutes(fastify: FastifyInstance) {
  // Upload product image (Admin)
  fastify.post('/product-image', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['upload'],
      summary: 'Upload Product Image',
      description: 'Upload product image, supports JPEG, PNG, WebP formats, max 5MB',
      security: [{ bearerAuth: [] }],
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

  // Upload user avatar (Authenticated user)
  fastify.post('/avatar', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['upload'],
      summary: 'Upload User Avatar',
      description: 'Upload user avatar, supports JPEG, PNG, WebP formats, max 5MB',
      security: [{ bearerAuth: [] }],
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

  // Delete file (Admin)
  fastify.delete('/file/:filename', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['upload'],
      summary: 'Delete File',
      description: 'Delete uploaded file and its thumbnails',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Filename' }
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
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        404: {
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
      const { filename } = request.params as { filename: string };

      await UploadService.deleteFile(`products/${filename}`);

      return reply.send({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message === 'File not found') {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'File not found'
        });
      }
      return reply.status(400).send({
        error: 'Delete failed',
        message
      });
    }
  });

  // Get image URL (Public)
  fastify.get('/image-url/:filename', {
    schema: {
      tags: ['upload'],
      summary: 'Get Image URL',
      description: 'Get image URLs in different sizes',
      params: {
        type: 'object',
        properties: {
          filename: { type: 'string', description: 'Filename' }
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
            description: 'Image size'
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

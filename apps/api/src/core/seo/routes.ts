/**
 * SEO Routes
 *
 * Handles SEO metadata, sitemaps, and redirects.
 */

import { FastifyInstance } from 'fastify';
import { SeoService } from './service';
import { SitemapService } from './sitemap.service';
import { RedirectService } from './redirect.service';
import { SeoAuditService } from './audit.service';
import { sendSuccess, sendError } from '@/utils/response';

/**
 * SEO metadata and redirect routes (mounted at /api/seo)
 */
export async function seoRoutes(fastify: FastifyInstance) {
  // Get product SEO metadata
  fastify.get('/products/:id', {
    schema: {
      tags: ['seo'],
      summary: 'Get product SEO metadata',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const seoData = await SeoService.getProductSeo(id);

      if (!seoData) {
        return sendError(reply, 404, 'NOT_FOUND', 'Product not found');
      }

      return sendSuccess(reply, seoData);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Update product SEO metadata
  fastify.put('/products/:id', {
    schema: {
      tags: ['seo'],
      summary: 'Update product SEO metadata',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          metaTitle: { type: 'string' },
          metaDescription: { type: 'string' },
          canonicalUrl: { type: 'string' },
          structuredData: {
            oneOf: [
              { type: 'string' },
              { type: 'object' }
            ]
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const seoData = request.body as any;

      const updated = await SeoService.updateProductSeo(id, seoData);
      return sendSuccess(reply, updated);
    } catch (error: any) {
      if (error.message === 'Product not found') {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get redirects list
  fastify.get('/redirects', {
    schema: {
      tags: ['seo'],
      summary: 'Get redirects list',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          isActive: { type: 'boolean' },
          search: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page, limit, isActive, search } = request.query as any;
      const result = await RedirectService.listRedirects(
        page || 1,
        limit || 10,
        { isActive, search }
      );
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Create redirect
  fastify.post('/redirects', {
    schema: {
      tags: ['seo'],
      summary: 'Create a new redirect',
      body: {
        type: 'object',
        required: ['fromPath', 'toPath'],
        properties: {
          fromPath: { type: 'string' },
          toPath: { type: 'string' },
          statusCode: { type: 'integer', enum: [301, 302, 307, 308], default: 301 },
          isActive: { type: 'boolean', default: true }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const redirectData = request.body as any;
      const redirect = await RedirectService.createRedirect(redirectData);
      return sendSuccess(reply, redirect, 'Redirect created successfully', 201);
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        return sendError(reply, 409, 'CONFLICT', error.message);
      }
      if (error.message.includes('must start with')) {
        return sendError(reply, 400, 'BAD_REQUEST', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Delete redirect
  fastify.delete('/redirects/:id', {
    schema: {
      tags: ['seo'],
      summary: 'Delete a redirect',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await RedirectService.deleteRedirect(id);
      return sendSuccess(reply, { message: 'Redirect deleted successfully' });
    } catch (error: any) {
      if (error.message === 'Redirect not found') {
        return sendError(reply, 404, 'NOT_FOUND', error.message);
      }
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Run SEO audit
  fastify.get('/audit', {
    schema: {
      tags: ['seo'],
      summary: 'Run SEO audit',
      querystring: {
        type: 'object',
        properties: {
          includeProducts: { type: 'boolean', default: true },
          includeCategories: { type: 'boolean', default: true },
          limit: { type: 'integer', default: 100 },
          offset: { type: 'integer', default: 0 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const options = request.query as any;
      const auditResult = await SeoAuditService.runAudit(options);
      return sendSuccess(reply, auditResult);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get audit statistics
  fastify.get('/audit/stats', {
    schema: {
      tags: ['seo'],
      summary: 'Get SEO audit statistics',
    }
  }, async (request, reply) => {
    try {
      const stats = await SeoAuditService.getAuditStats();
      return sendSuccess(reply, stats);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}

/**
 * Sitemap route (mounted at /api for /api/sitemap.xml)
 */
export async function sitemapRoute(fastify: FastifyInstance) {
  fastify.get('/sitemap.xml', {
    schema: {
      tags: ['seo'],
      summary: 'Generate XML sitemap',
      querystring: {
        type: 'object',
        properties: {
          includeProducts: { type: 'boolean', default: true },
          includeCategories: { type: 'boolean', default: true },
          includePages: { type: 'boolean', default: true }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const options = request.query as any;
      const sitemap = await SitemapService.generateSitemap(options);

      reply.type('application/xml');
      return sitemap;
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });
}

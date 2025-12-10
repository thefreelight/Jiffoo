/**
 * Marketplace BFF Routes
 * 
 * Backend-for-Frontend routes for official Jiffoo marketplace
 * Provides unified API for themes and plugins from marketplace
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Readable } from 'stream';
import { authMiddleware, tenantMiddleware, adminMiddleware } from '@/core/auth/middleware';
import {
  checkMarketplaceStatus,
  fetchThemes,
  fetchThemeDetails,
  downloadTheme,
  fetchPlugins,
  fetchPluginDetails,
  downloadPlugin,
} from './client';
import { ExtensionInstaller } from '../extension-installer';
import * as fs from 'fs';

/**
 * Convert Buffer to Readable stream
 */
function bufferToStream(buffer: Buffer): Readable {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

export async function marketplaceRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/marketplace/status
   * Check marketplace connectivity
   */
  fastify.get('/status', {
    schema: {
      tags: ['Marketplace'],
      summary: 'Check Marketplace Status',
      description: 'Check if official marketplace is online and accessible',
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await checkMarketplaceStatus();
      return reply.send({ success: true, data: status });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to check marketplace status');
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================================
  // Theme Marketplace Routes
  // ============================================================================

  /**
   * GET /api/marketplace/themes
   * List themes from official marketplace
   */
  fastify.get('/themes', {
    schema: {
      tags: ['Marketplace'],
      summary: 'List Marketplace Themes',
      description: 'Get themes from official Jiffoo marketplace',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const result = await fetchThemes({
        category: query.category,
        search: query.search,
        priceType: query.priceType,
        sortBy: query.sortBy || 'popular',
        page: parseInt(query.page || '1', 10),
        limit: parseInt(query.limit || '10', 10),
      });

      const status = await checkMarketplaceStatus();
      return reply.send({
        success: true,
        data: result,
        marketplace: { online: status.online },
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to fetch marketplace themes');
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/marketplace/themes/:slug
   * Get theme details from marketplace
   */
  fastify.get('/themes/:slug', {
    schema: {
      tags: ['Marketplace'],
      summary: 'Get Marketplace Theme Details',
    },
  }, async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
    try {
      const { slug } = request.params;
      const theme = await fetchThemeDetails(slug);

      if (!theme) {
        const status = await checkMarketplaceStatus();
        return reply.status(404).send({
          success: false,
          error: status.online ? 'Theme not found' : 'Marketplace offline',
          marketplace: { online: status.online },
        });
      }

      return reply.send({ success: true, data: theme });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to fetch theme details');
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/marketplace/themes/:slug/install
   * Download and install theme from marketplace
   */
  fastify.post('/themes/:slug/install', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['Marketplace'],
      summary: 'Install Theme from Marketplace',
    },
  }, async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
    try {
      const { slug } = request.params;

      // Download theme
      const downloadResult = await downloadTheme(slug);
      if (!downloadResult.success || !downloadResult.zipPath) {
        return reply.status(400).send({
          success: false,
          error: downloadResult.error || 'Download failed',
        });
      }

      // Install using ExtensionInstaller
      const zipBuffer = fs.readFileSync(downloadResult.zipPath);
      const zipStream = bufferToStream(zipBuffer);
      const installer = new ExtensionInstaller();
      const installResult = await installer.installFromZip('theme-shop', zipStream);

      // Clean up temp file
      fs.unlinkSync(downloadResult.zipPath);

      return reply.send({
        success: true,
        data: {
          slug: installResult.slug,
          version: installResult.version,
          message: `Theme "${slug}" installed successfully`,
        },
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to install theme from marketplace');
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================================
  // Plugin Marketplace Routes
  // ============================================================================

  /**
   * GET /api/marketplace/plugins
   * List plugins from official marketplace
   */
  fastify.get('/plugins', {
    schema: {
      tags: ['Marketplace'],
      summary: 'List Marketplace Plugins',
      description: 'Get plugins from official Jiffoo marketplace',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const result = await fetchPlugins({
        category: query.category,
        search: query.search,
        priceType: query.priceType,
        sortBy: query.sortBy || 'popular',
        page: parseInt(query.page || '1', 10),
        limit: parseInt(query.limit || '10', 10),
      });

      const status = await checkMarketplaceStatus();
      return reply.send({
        success: true,
        data: result,
        marketplace: { online: status.online },
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to fetch marketplace plugins');
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/marketplace/plugins/:slug
   * Get plugin details from marketplace
   */
  fastify.get('/plugins/:slug', {
    schema: {
      tags: ['Marketplace'],
      summary: 'Get Marketplace Plugin Details',
    },
  }, async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
    try {
      const { slug } = request.params;
      const plugin = await fetchPluginDetails(slug);

      if (!plugin) {
        const status = await checkMarketplaceStatus();
        return reply.status(404).send({
          success: false,
          error: status.online ? 'Plugin not found' : 'Marketplace offline',
          marketplace: { online: status.online },
        });
      }

      return reply.send({ success: true, data: plugin });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to fetch plugin details');
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/marketplace/plugins/:slug/install
   * Download and install plugin from marketplace
   */
  fastify.post('/plugins/:slug/install', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['Marketplace'],
      summary: 'Install Plugin from Marketplace',
    },
  }, async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
    try {
      const { slug } = request.params;

      // Download plugin
      const downloadResult = await downloadPlugin(slug);
      if (!downloadResult.success || !downloadResult.zipPath) {
        return reply.status(400).send({
          success: false,
          error: downloadResult.error || 'Download failed',
        });
      }

      // Install using ExtensionInstaller
      const zipBuffer = fs.readFileSync(downloadResult.zipPath);
      const zipStream = bufferToStream(zipBuffer);
      const installer = new ExtensionInstaller();
      const installResult = await installer.installFromZip('plugin', zipStream);

      // Clean up temp file
      fs.unlinkSync(downloadResult.zipPath);

      return reply.send({
        success: true,
        data: {
          slug: installResult.slug,
          version: installResult.version,
          message: `Plugin "${slug}" installed successfully`,
        },
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to install plugin from marketplace');
      return reply.status(500).send({ success: false, error: error.message });
    }
  });
}


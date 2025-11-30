import { FastifyInstance } from 'fastify';
import { ProductService } from './service';
import { tenantResolver } from '@/core/auth/middleware';
import { withTenantContext } from '@/core/database/tenant-middleware';
import { getLocaleFromRequest, Locale } from '@/utils/i18n';

/**
 * 公开商品API路由
 * 面向普通用户和访客的商品浏览功能
 *
 * 🆕 支持 Agent Mall 场景：
 * - 通过 X-Agent-ID header 或 ?agentId 参数识别代理商城
 * - 返回经过授权过滤的变体列表
 * - 返回代理配置的有效价格
 */
export async function productRoutes(fastify: FastifyInstance) {
  // Get all products (public with tenant context)
  // Supports language negotiation via ?locale= query param or Accept-Language header
  // 🆕 Supports Agent Mall via X-Agent-ID header or ?agentId query param
  fastify.get('/', {
    preHandler: [tenantResolver],
    schema: {
      tags: ['products'],
      summary: 'Get all products',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          search: { type: 'string' },
          category: { type: 'string' },
          minPrice: { type: 'number' },
          maxPrice: { type: 'number' },
          inStock: { type: 'boolean' },
          sortBy: { type: 'string', default: 'createdAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          locale: { type: 'string', enum: ['en', 'zh-Hant'], description: 'Locale for product translations' },
          agentId: { type: 'string', description: 'Agent ID for agent mall context' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object', additionalProperties: true } },
            pagination: { type: 'object', additionalProperties: true },
            locale: { type: 'string', description: 'The locale used for this response' },
            mallContext: { type: 'object', description: 'Mall context info (tenant or agent)' }
          }
        },
        '4xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        '5xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        category,
        minPrice,
        maxPrice,
        inStock,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        locale: queryLocale,
        agentId: queryAgentId
      } = request.query as any;

      // Resolve locale from query param or Accept-Language header
      const acceptLanguage = request.headers['accept-language'];
      const locale: Locale = getLocaleFromRequest(queryLocale, acceptLanguage);

      // 🆕 Resolve agent context from header or query param
      const agentId = (request.headers['x-agent-id'] as string) || queryAgentId || null;

      const filters = {
        search,
        category,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        inStock: inStock !== undefined ? Boolean(inStock) : undefined,
        sortBy,
        sortOrder,
      };

      const tenantId = (request as any).user?.tenantId || (request as any).tenantId;

      // 🆕 Pass agentId to service for authorization filtering
      const result = await withTenantContext(tenantId, (request as any).user?.id, async () => {
        return await ProductService.getPublicProducts(Number(page), Number(limit), filters, tenantId, locale, agentId);
      });

      return reply.send({
        success: true,
        data: result.products,
        pagination: result.pagination,
        locale: locale,
        mallContext: result.mallContext
      });
    } catch {
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });



  // Get categories (public)
  fastify.get('/categories', {
    preHandler: [tenantResolver],
    schema: {
      tags: ['products'],
      summary: 'Get product categories',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'string' } }
          }
        },
        '4xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        '5xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const tenantId = (request as any).user?.tenantId || (request as any).tenantId;
      if (!tenantId) {
        return reply.status(400).send({
          success: false,
          error: 'Tenant context is required'
        });
      }
      const categories = await withTenantContext(tenantId, (request as any).user?.id, async () => {
        return await ProductService.getCategories(tenantId);
      });
      return reply.send({
        success: true,
        data: categories
      });
    } catch {
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // Get product by ID (public with tenant context)
  // Supports language negotiation via ?locale= query param or Accept-Language header
  // 🆕 Supports Agent Mall via X-Agent-ID header or ?agentId query param
  fastify.get('/:id', {
    preHandler: [tenantResolver],
    schema: {
      tags: ['products'],
      summary: 'Get product by ID',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          locale: { type: 'string', enum: ['en', 'zh-Hant'], description: 'Locale for product translations' },
          agentId: { type: 'string', description: 'Agent ID for agent mall context' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
            locale: { type: 'string', description: 'The locale used for this response' },
            mallContext: { type: 'object', description: 'Mall context info (tenant or agent)' }
          }
        },
        '4xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        '5xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { locale: queryLocale, agentId: queryAgentId } = request.query as { locale?: string; agentId?: string };

      // Resolve locale from query param or Accept-Language header
      const acceptLanguage = request.headers['accept-language'];
      const locale: Locale = getLocaleFromRequest(queryLocale, acceptLanguage);

      // 🆕 Resolve agent context from header or query param
      const agentId = (request.headers['x-agent-id'] as string) || queryAgentId || null;

      const tenantId = (request as any).user?.tenantId || (request as any).tenantId;
      const result = await withTenantContext(tenantId, (request as any).user?.id, async () => {
        return await ProductService.getPublicProductById(id, tenantId, locale, agentId);
      });
      if (!result || !result.product) {
        return reply.status(404).send({
          success: false,
          error: 'Product not found'
        });
      }
      return reply.send({
        success: true,
        data: result.product,
        locale: locale,
        mallContext: result.mallContext
      });
    } catch {
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      });
    }
  });
}


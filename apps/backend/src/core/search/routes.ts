import { FastifyInstance } from 'fastify';
import { SearchService, SearchFilters, SortOptions } from './service';

export async function searchRoutes(fastify: FastifyInstance) {
  // 高级搜索
  fastify.get('/products', {
    schema: {
      tags: ['search'],
      summary: '高级商品搜索',
      description: '支持关键词、价格范围、分类等多维度搜索',
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', description: '搜索关键词' },
          category: { type: 'string', description: '商品分类' },
          minPrice: { type: 'number', minimum: 0, description: '最低价格' },
          maxPrice: { type: 'number', minimum: 0, description: '最高价格' },
          inStock: { type: 'boolean', description: '是否有库存' },
          sortBy: { 
            type: 'string', 
            enum: ['name', 'price', 'createdAt', 'updatedAt', 'stock'],
            default: 'createdAt',
            description: '排序字段'
          },
          sortOrder: { 
            type: 'string', 
            enum: ['asc', 'desc'],
            default: 'desc',
            description: '排序方向'
          },
          page: { type: 'integer', minimum: 1, default: 1, description: '页码' },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10, description: '每页数量' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            products: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'number' },
                  stock: { type: 'integer' },
                  images: { type: 'string' },
                  totalSold: { type: 'integer' },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' }
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' }
              }
            },
            filters: { type: 'object' },
            sort: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const {
        q,
        category,
        minPrice,
        maxPrice,
        inStock,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        page = 1,
        limit = 10
      } = request.query as any;

      const filters: SearchFilters = {
        category,
        minPrice,
        maxPrice,
        inStock
      };

      const sort: SortOptions = {
        field: sortBy,
        order: sortOrder
      };

      const result = await SearchService.searchProducts(
        q,
        filters,
        sort,
        Number(page),
        Number(limit)
      );

      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 搜索建议
  fastify.get('/suggestions', {
    schema: {
      tags: ['search'],
      summary: '搜索建议',
      description: '根据输入提供搜索建议',
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', description: '搜索关键词' },
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 5, description: '建议数量' }
        },
        required: ['q']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { q, limit = 5 } = request.query as { q: string; limit?: number };
      
      const suggestions = await SearchService.getSearchSuggestions(q, Number(limit));
      
      return reply.send({ suggestions });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get suggestions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 热门搜索词
  fastify.get('/popular-terms', {
    schema: {
      tags: ['search'],
      summary: '热门搜索词',
      description: '获取热门搜索词列表',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: '返回数量' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            terms: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  term: { type: 'string' },
                  count: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { limit = 10 } = request.query as { limit?: number };
      
      const terms = await SearchService.getPopularSearchTerms(Number(limit));
      
      return reply.send({ terms });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get popular terms',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 商品分类
  fastify.get('/categories', {
    schema: {
      tags: ['search'],
      summary: '商品分类',
      description: '获取所有商品分类及数量',
      response: {
        200: {
          type: 'object',
          properties: {
            categories: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  category: { type: 'string' },
                  count: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const categories = await SearchService.getProductCategories();
      
      return reply.send({ categories });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get categories',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 价格范围
  fastify.get('/price-range', {
    schema: {
      tags: ['search'],
      summary: '价格范围',
      description: '获取商品价格范围',
      response: {
        200: {
          type: 'object',
          properties: {
            min: { type: 'number' },
            max: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const priceRange = await SearchService.getPriceRange();
      
      return reply.send(priceRange);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get price range',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 相关商品
  fastify.get('/related/:productId', {
    schema: {
      tags: ['search'],
      summary: '相关商品',
      description: '获取相关商品推荐',
      params: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: '商品ID' }
        },
        required: ['productId']
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 20, default: 5, description: '推荐数量' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            products: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'number' },
                  stock: { type: 'integer' },
                  images: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { productId } = request.params as { productId: string };
      const { limit = 5 } = request.query as { limit?: number };
      
      const products = await SearchService.getRelatedProducts(productId, Number(limit));
      
      return reply.send({ products });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get related products',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, superAdminMiddleware } from '@/core/auth/middleware';
import { SuperAdminTenantService } from './service';
import {
  CreateTenantSchema,
  UpdateTenantSchema,
  UpdateTenantStatusSchema,
  GetTenantsRequest
} from './types';

export async function superAdminTenantRoutes(fastify: FastifyInstance) {
  // 应用中间件到所有路由
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', superAdminMiddleware);

  /**
   * 创建租户
   * POST /api/super-admin/tenants
   */
  fastify.post('/', {
    schema: {
      hide: true,
      tags: ['super-admin-tenants'],
      summary: 'Create tenant (Super Admin)',
      description: 'Create a new tenant with admin user',
      body: {
        type: 'object',
        required: ['companyName', 'contactName', 'contactEmail', 'adminUser'],
        properties: {
          companyName: { type: 'string' },
          contactName: { type: 'string' },
          contactEmail: { type: 'string', format: 'email' },
          contactPhone: { type: 'string' },
          domain: { type: 'string' },
          subdomain: { type: 'string' },
          branding: { type: 'object' },
          settings: { type: 'object' },
          adminUser: {
            type: 'object',
            required: ['email', 'username', 'password'],
            properties: {
              email: { type: 'string', format: 'email' },
              username: { type: 'string' },
              password: { type: 'string' },
              avatar: { type: 'string' }
            }
          }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                companyName: { type: 'string' },
                contactName: { type: 'string' },
                contactEmail: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedData = CreateTenantSchema.parse(request.body);
      const result = await SuperAdminTenantService.createTenant(validatedData);

      reply.code(201).send(result);
    } catch (error) {
      console.error('Create tenant error:', error);
      reply.code(400).send({
        success: false,
        message: 'Failed to create tenant',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取租户统计信息
   * GET /api/super-admin/tenants/stats
   * 注意：此路由必须在 /:id 之前注册，避免路由冲突
   */
  fastify.get('/stats', {
    schema: {
      hide: true,
      tags: ['super-admin-tenants'],
      summary: 'Get tenant statistics (Super Admin)',
      description: 'Get tenant statistics and overview'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await SuperAdminTenantService.getTenantStats();
      reply.code(200).send(result);
    } catch (error) {
      console.error('Get tenant stats error:', error);
      reply.code(500).send({
        success: false,
        message: 'Failed to get tenant statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取所有租户列表
   * GET /api/super-admin/tenants
   */
  fastify.get('/', {
    schema: {
      hide: true,
      tags: ['super-admin-tenants'],
      summary: 'Get all tenants (Super Admin)',
      description: 'Get all tenants with pagination, search and filtering',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          search: { type: 'string', description: 'Search by company name, contact name, or email' },
          status: { type: 'string', enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED'] },
          sortBy: { type: 'string', enum: ['companyName', 'contactName', 'createdAt', 'status'], default: 'createdAt' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as GetTenantsRequest;
      const result = await SuperAdminTenantService.getAllTenants(query);

      reply.code(200).send(result);
    } catch (error) {
      console.error('Get all tenants error:', error);
      reply.code(500).send({
        success: false,
        message: 'Failed to get tenants',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取租户详情
   * GET /api/super-admin/tenants/:id
   */
  fastify.get('/:id', {
    schema: {
      hide: true,
      tags: ['super-admin-tenants'],
      summary: 'Get tenant details (Super Admin)',
      description: 'Get detailed information about a specific tenant',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await SuperAdminTenantService.getTenantById(id);

      reply.code(200).send(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'Tenant not found') {
        return reply.code(404).send({
          success: false,
          message: 'Tenant not found'
        });
      }

      console.error('Get tenant error:', error);
      reply.code(500).send({
        success: false,
        message: 'Failed to get tenant',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 更新租户信息
   * PUT /api/super-admin/tenants/:id
   */
  fastify.put('/:id', {
    schema: {
      hide: true,
      tags: ['super-admin-tenants'],
      summary: 'Update tenant (Super Admin)',
      description: 'Update tenant information',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          companyName: { type: 'string' },
          contactName: { type: 'string' },
          contactEmail: { type: 'string', format: 'email' },
          contactPhone: { type: 'string' },
          domain: { type: 'string' },
          subdomain: { type: 'string' },
          branding: { type: 'object' },
          settings: { type: 'object' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const validatedData = UpdateTenantSchema.parse(request.body);
      const result = await SuperAdminTenantService.updateTenant(id, validatedData);

      reply.code(200).send(result);
    } catch (error) {
      console.error('Update tenant error:', error);
      reply.code(400).send({
        success: false,
        message: 'Failed to update tenant',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });



  /**
   * 更新租户状态（包括激活、暂停、停用等）
   * PUT /api/super-admin/tenants/:id/status
   */
  fastify.put('/:id/status', {
    schema: {
      hide: true,
      tags: ['super-admin-tenants'],
      summary: 'Update tenant status (Super Admin)',
      description: 'Update tenant status: activate, suspend, terminate, etc.',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED'] },
          reason: { type: 'string' },
          notes: { type: 'string' },
          // 激活时的额外参数
          paymentReference: { type: 'string' },
          contractDuration: { type: 'number', default: 365 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const validatedData = UpdateTenantStatusSchema.parse(request.body);
      const result = await SuperAdminTenantService.updateTenantStatus(id, validatedData);

      reply.code(200).send(result);
    } catch (error) {
      console.error('Update tenant status error:', error);
      reply.code(400).send({
        success: false,
        message: 'Failed to update tenant status',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 删除租户
   * DELETE /api/super-admin/tenants/:id
   */
  fastify.delete('/:id', {
    schema: {
      hide: true,
      tags: ['super-admin-tenants'],
      summary: 'Delete tenant (Super Admin)',
      description: 'Delete a tenant (only if no associated data exists)',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      await SuperAdminTenantService.deleteTenant(id);

      reply.code(200).send({
        success: true,
        message: 'Tenant deleted successfully'
      });
    } catch (error) {
      console.error('Delete tenant error:', error);
      reply.code(400).send({
        success: false,
        message: 'Failed to delete tenant',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

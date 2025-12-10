/**
 * Multi-Tenant Plugin
 * 
 * 多租户系统插件 - 提供完整的多租户功能
 */

const fp = require('fastify-plugin');

async function multiTenantPlugin(fastify, options) {
  const {
    enableTenantIsolation = true,
    allowTenantRegistration = false,
    maxTenantsPerInstance = 100,
  } = options;

  // 激活多租户模式
  fastify.addHook('onReady', async () => {
    try {
      await fastify.prisma.systemSettings.upsert({
        where: { id: 'system' },
        update: { tenantMode: 'multi' },
        create: { id: 'system', tenantMode: 'multi', defaultTenantId: 1 },
      });
      
      if (fastify.clearTenantConfigCache) {
        fastify.clearTenantConfigCache();
      }
      
      fastify.log.info('Multi-tenant plugin activated');
    } catch (error) {
      fastify.log.error(error, 'Failed to activate multi-tenant mode');
    }
  });

  // 获取所有租户
  fastify.get('/tenants', async (request, reply) => {
    const tenants = await fastify.prisma.tenant.findMany({
      select: { id: true, name: true, slug: true, domain: true, status: true, createdAt: true, updatedAt: true },
    });
    return { success: true, data: { tenants, total: tenants.length } };
  });

  // 创建租户
  fastify.post('/tenants', async (request, reply) => {
    const { name, slug, domain, config } = request.body;
    
    const count = await fastify.prisma.tenant.count();
    if (count >= maxTenantsPerInstance) {
      return reply.status(400).send({
        success: false, error: 'MAX_TENANTS_REACHED',
        message: `Maximum number of tenants (${maxTenantsPerInstance}) reached`,
      });
    }

    const existing = await fastify.prisma.tenant.findFirst({ where: { slug } });
    if (existing) {
      return reply.status(400).send({
        success: false, error: 'SLUG_EXISTS',
        message: 'Tenant with this slug already exists',
      });
    }

    const tenant = await fastify.prisma.tenant.create({
      data: { name, slug, domain: domain || null, status: 'ACTIVE', config: config || {} },
    });
    return { success: true, data: { tenant } };
  });

  // 获取单个租户
  fastify.get('/tenants/:id', async (request, reply) => {
    const { id } = request.params;
    const tenant = await fastify.prisma.tenant.findUnique({ where: { id: parseInt(id) } });
    if (!tenant) {
      return reply.status(404).send({ success: false, error: 'TENANT_NOT_FOUND' });
    }
    return { success: true, data: { tenant } };
  });

  // 更新租户
  fastify.put('/tenants/:id', async (request, reply) => {
    const { id } = request.params;
    const tenant = await fastify.prisma.tenant.update({
      where: { id: parseInt(id) },
      data: request.body,
    });
    return { success: true, data: { tenant } };
  });

  // 删除租户
  fastify.delete('/tenants/:id', async (request, reply) => {
    const { id } = request.params;
    if (parseInt(id) === 1) {
      return reply.status(400).send({
        success: false, error: 'CANNOT_DELETE_DEFAULT_TENANT',
        message: 'Cannot delete the default tenant',
      });
    }
    await fastify.prisma.tenant.delete({ where: { id: parseInt(id) } });
    return { success: true, message: 'Tenant deleted successfully' };
  });

  // 获取当前租户模式
  fastify.get('/mode', async (request, reply) => {
    const settings = await fastify.prisma.systemSettings.findUnique({ where: { id: 'system' } });
    return {
      success: true,
      data: {
        mode: settings?.tenantMode || 'single',
        enableTenantIsolation,
        allowTenantRegistration,
        maxTenantsPerInstance,
      },
    };
  });

  // 切换租户模式
  fastify.post('/mode/toggle', async (request, reply) => {
    const { mode } = request.body;
    await fastify.prisma.systemSettings.upsert({
      where: { id: 'system' },
      update: { tenantMode: mode },
      create: { id: 'system', tenantMode: mode, defaultTenantId: 1 },
    });
    if (fastify.clearTenantConfigCache) {
      fastify.clearTenantConfigCache();
    }
    return { success: true, data: { mode }, message: `System is now in ${mode}-tenant mode` };
  });
}

module.exports = fp(multiTenantPlugin, {
  name: 'multi-tenant-plugin',
  fastify: '5.x',
});

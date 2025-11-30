import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

/**
 * Tenant Context Plugin
 *
 * 为所有请求提供租户上下文，从请求中提取租户ID并验证租户存在性。
 * 装饰请求对象，添加 tenant 属性。
 */
const tenantContext: FastifyPluginAsync = async (fastify, _options) => {
  // 装饰请求对象
  fastify.decorateRequest('tenant', null)

  // 添加preHandler钩子
  fastify.addHook('preHandler', async (request, reply) => {
    // 跳过健康检查、根路径、超级管理员路由、认证路由、认证网关路由、商城上下文路由、Webhook 路由、支付重定向路由、verify-session路由和OAuth回调路由的租户检查
    if (request.routeOptions?.url === '/' ||
        request.routeOptions?.url?.startsWith('/health') || // /health, /health/live, /health/ready
        request.routeOptions?.url?.startsWith('/api/super-admin/') ||
        request.routeOptions?.url?.startsWith('/api/auth/') ||
        request.routeOptions?.url?.startsWith('/api/auth-gateway/') ||
        request.routeOptions?.url?.startsWith('/api/mall/context') ||
        request.routeOptions?.url?.includes('/webhook') ||
        request.routeOptions?.url?.includes('/verify-session') ||
        request.routeOptions?.url?.includes('/auth/callback') ||
        request.routeOptions?.url === '/success' ||
        request.routeOptions?.url === '/cancel') {
      // 这些路由可以选择性地使用租户上下文
      const tenantId = extractTenantId(request)
      if (tenantId) {
        const tenant = await fastify.prisma.tenant.findUnique({
          where: { id: tenantId }
        })
        if (tenant) {
          request.tenant = tenant
        }
      }
      return // 继续处理，不强制要求租户上下文
    }

    const tenantId = extractTenantId(request)

    if (!tenantId) {
      return reply.status(401).send({ error: 'Tenant context required' })
    }

    const tenant = await fastify.prisma.tenant.findUnique({
      where: { id: tenantId }
    })

    if (!tenant) {
      return reply.status(404).send({ error: 'Tenant not found' })
    }

    request.tenant = tenant
  })
}

/**
 * 从请求中提取租户ID
 * 优先级：用户信息 > 请求头 > 查询参数 > 请求体
 */
function extractTenantId(request: any): number | null {
  // 从用户信息中提取租户ID
  if (request.user?.tenantId) {
    return request.user.tenantId
  }
  
  // 从请求头中提取租户ID
  if (request.headers['x-tenant-id']) {
    return parseInt(request.headers['x-tenant-id'])
  }
  
  // 从查询参数中提取租户ID
  if (request.query?.tenantId) {
    return parseInt(request.query.tenantId)
  }
  
  // 从请求体中提取租户ID
  if (request.body?.tenantId) {
    return parseInt(request.body.tenantId)
  }
  
  return null
}

export default fp(tenantContext, {
  name: 'tenant-context',
  fastify: '5.x',
  decorators: {
    fastify: ['prisma']
  }
})

/**
 * Agent Plugin - 三级代理系统插件
 *
 * 提供三级代理功能：
 * - 代理创建和管理（L1/L2/L3）
 * - 代理Mall配置
 * - 代理域名管理
 * - 三级代理费率配置
 * - 商品授权管理
 * - 代理佣金计算和追踪
 * - Super Admin管理功能
 * - 🆕 变体级授权配置（Self路径 + Children路径）
 *
 * 注意：此插件不使用 fastify-plugin 包装，保持封装以避免路由泄露
 * 符合Fastify官方最佳实践，与Affiliate插件保持一致
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '@/core/auth/middleware';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { AgentAuthorizationService } from './agent/authorization';

// ============================================
// 常量定义
// ============================================

const AGENT_LEVELS = [1, 2, 3] as const;

const AgentStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  REJECTED: 'REJECTED'
} as const;

const AgentCommissionStatus = {
  PENDING: 'PENDING',
  SETTLED: 'SETTLED',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED'
} as const;

// ============================================
// 验证Schema
// ============================================

const createAgentSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  name: z.string().min(1, 'Agent name is required'),
  level: z.number().min(1).max(3),
  parentAgentId: z.string().optional(),
  notes: z.string().optional()
});

const updateAgentStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REJECTED'])
});

const updateAgentLevelConfigSchema = z.object({
  commissionRate: z.number().min(0).max(100),
  maxAgentsPerParent: z.number().min(1).optional(),
  maxProducts: z.number().min(1).optional().nullable(),
  l1ShareRate: z.number().min(0).max(100).optional().nullable(),
  l2ShareRate: z.number().min(0).max(100).optional().nullable(),
  l3ShareRate: z.number().min(0).max(100).optional().nullable()
});

const updateMallConfigSchema = z.object({
  themeSlug: z.string().optional().nullable(),
  themeConfig: z.any().optional(),
  settings: z.any().optional(),
  defaultDomainType: z.enum(['platform', 'tenant', 'own-domain']).optional()
});

const manageAgentDomainSchema = z.object({
  host: z.string().min(1),
  isPrimary: z.boolean().optional()
});

// ============================================
// 工具函数
// ============================================

/**
 * 生成代理邀请码
 */
function generateAgentCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'AG';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * 检查用户是否有权限访问租户资源
 */
function canAccessTenant(user: any, tenantId: number): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role === 'TENANT_ADMIN' && user.tenantId === tenantId) return true;
  return false;
}

/**
 * 检查用户是否有权限访问代理资源
 */
async function canAccessAgent(user: any, agentId: string): Promise<boolean> {
  if (user.role === 'SUPER_ADMIN') return true;
  
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { tenantId: true, userId: true }
  });
  
  if (!agent) return false;
  
  // 租户管理员可以访问本租户的代理
  if (user.role === 'TENANT_ADMIN' && user.tenantId === agent.tenantId) return true;
  
  // 代理本人可以访问
  if (user.id === agent.userId) return true;
  
  return false;
}

/**
 * 获取代理的上级链路（用于三级分润）
 */
async function getAgentChain(agentId: string): Promise<Array<{ id: string; level: number }>> {
  const chain: Array<{ id: string; level: number }> = [];
  let currentId: string | null = agentId;
  
  while (currentId) {
    const agent = await prisma.agent.findUnique({
      where: { id: currentId },
      select: { id: true, level: true, parentAgentId: true }
    });
    
    if (!agent) break;
    chain.push({ id: agent.id, level: agent.level });
    currentId = agent.parentAgentId;
  }
  
  return chain;
}

// ============================================
// 许可证检查中间件
// ============================================

function createAgentLicenseCheckMiddleware(fastify: any) {
  return async function checkAgentLicense(request: FastifyRequest, reply: FastifyReply) {
    const tenantId = (request as any).tenantId || (request as any).user?.tenantId;

    if (!tenantId) {
      return reply.status(401).send({
        success: false,
        error: 'Tenant ID required'
      });
    }

    // 检查插件许可证
    const license = await prisma.pluginLicense.findFirst({
      where: {
        tenantId: parseInt(tenantId),
        plugin: { slug: 'agent' },
        status: 'ACTIVE'
      }
    });

    if (!license) {
      return reply.status(403).send({
        success: false,
        error: 'Agent plugin license not found or not active',
        upgradeUrl: '/plugins/agent/install'
      });
    }
  };
}

// ============================================
// 代理佣金计算
// ============================================

/**
 * 计算代理订单的三级佣金
 */
async function calculateAgentCommission(orderId: string, tenantId: number, agentId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId }
  });

  if (!order) {
    throw new Error('Order not found');
  }

  if (order.agentCommissionCalculated) {
    return;
  }

  // 获取代理链路
  const agentChain = await getAgentChain(agentId);

  // 获取租户的代理等级配置
  const levelConfigs = await prisma.agentLevelConfig.findMany({
    where: { tenantId }
  });

  if (levelConfigs.length === 0) {
    // 没有配置代理等级费率，跳过
    await prisma.order.update({
      where: { id: orderId },
      data: { agentCommissionCalculated: true }
    });
    return;
  }

  const configMap = new Map<number, typeof levelConfigs[0]>(levelConfigs.map(c => [c.level, c]));
  const commissionRecords: any[] = [];
  const balanceUpdates: any[] = [];
  const settleAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天后结算

  // 为链路中的每个代理计算佣金
  for (const agent of agentChain) {
    const config = configMap.get(agent.level);
    if (!config) continue;

    // 根据订单来源确定分润比例
    let rate = config.commissionRate;

    // 如果是下级代理的订单，使用上级的分润比例
    const sourceAgent = agentChain[0];
    if (sourceAgent.id !== agent.id) {
      // 根据来源代理的等级确定分润
      if (sourceAgent.level === 3 && agent.level === 2) {
        rate = config.l2ShareRate || 0;
      } else if (sourceAgent.level === 3 && agent.level === 1) {
        rate = config.l1ShareRate || 0;
      } else if (sourceAgent.level === 2 && agent.level === 1) {
        rate = config.l1ShareRate || 0;
      }
    }

    if (rate <= 0) continue;

    const amount = order.totalAmount * (rate / 100);

    commissionRecords.push({
      tenantId,
      agentId: agent.id,
      orderId: order.id,
      buyerId: order.userId,
      agentLevel: agent.level,
      sourceAgentId: sourceAgent.id,
      orderAmount: order.totalAmount,
      rate,
      amount,
      status: AgentCommissionStatus.PENDING,
      settleAt
    });

    balanceUpdates.push(
      prisma.agent.update({
        where: { id: agent.id },
        data: {
          pendingBalance: { increment: amount },
          totalCommission: { increment: amount },
          totalOrders: { increment: agent.id === sourceAgent.id ? 1 : 0 },
          totalSales: { increment: agent.id === sourceAgent.id ? order.totalAmount : 0 }
        }
      })
    );
  }

  // 批量创建佣金记录和更新代理余额
  await prisma.$transaction([
    ...commissionRecords.map(record => prisma.agentCommission.create({ data: record })),
    ...balanceUpdates,
    prisma.order.update({
      where: { id: orderId },
      data: { agentCommissionCalculated: true }
    })
  ]);
}

// ============================================
// 插件定义
// ============================================

const agentPlugin: FastifyPluginAsync = async (fastify) => {
  // 装饰器：暴露 calculateAgentCommission 方法供其他插件调用
  fastify.decorate('calculateAgentCommission', async function (orderId: string, tenantId: number, agentId: string) {
    return await calculateAgentCommission(orderId, tenantId, agentId);
  });

  // 🆕 装饰器：暴露授权服务供核心模块调用
  fastify.decorate('agentAuthorization', AgentAuthorizationService);

  // 创建许可证检查中间件
  const checkAgentLicense = createAgentLicenseCheckMiddleware(fastify);

  // ============================================
  // 租户维度API - 代理管理
  // ============================================

  // 创建代理
  fastify.post<{ Params: { tenantId: string } }>('/tenants/:tenantId/agents', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const tenantId = parseInt(request.params.tenantId);

      if (!canAccessTenant(user, tenantId)) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const validation = createAgentSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ success: false, error: validation.error.errors });
      }

      const { userId, name, level, parentAgentId, notes } = validation.data;

      // 验证用户存在且属于该租户
      const targetUser = await prisma.user.findFirst({
        where: { id: userId, tenantId }
      });

      if (!targetUser) {
        return reply.status(404).send({ success: false, error: 'User not found in this tenant' });
      }

      // 检查用户是否已是代理
      const existingAgent = await prisma.agent.findFirst({
        where: { tenantId, userId }
      });

      if (existingAgent) {
        return reply.status(409).send({ success: false, error: 'User is already an agent' });
      }

      // 验证父级代理（如果指定）
      if (parentAgentId) {
        const parentAgent = await prisma.agent.findFirst({
          where: { id: parentAgentId, tenantId, status: 'ACTIVE' }
        });

        if (!parentAgent) {
          return reply.status(404).send({ success: false, error: 'Parent agent not found' });
        }

        // 验证层级关系
        if (level <= parentAgent.level) {
          return reply.status(400).send({
            success: false,
            error: 'Agent level must be higher than parent agent level'
          });
        }
      }

      // 生成唯一代理码
      let code = generateAgentCode();
      let attempts = 0;
      while (attempts < 10) {
        const existing = await prisma.agent.findFirst({ where: { tenantId, code } });
        if (!existing) break;
        code = generateAgentCode();
        attempts++;
      }

      const agent = await prisma.agent.create({
        data: {
          tenantId,
          userId,
          code,
          name,
          level,
          parentAgentId,
          status: AgentStatus.PENDING,
          invitedByTenantId: tenantId,
          invitedByAgentId: parentAgentId,
          notes
        },
        include: {
          user: { select: { id: true, email: true, username: true } },
          parentAgent: { select: { id: true, name: true, code: true } }
        }
      });

      // 创建默认Mall配置
      await prisma.agentMallConfig.create({
        data: {
          agentId: agent.id,
          tenantId
        }
      });

      return reply.status(201).send({ success: true, data: agent });
    } catch (error: any) {
      fastify.log.error('Failed to create agent:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 获取代理列表（支持树形结构）
  fastify.get<{ Params: { tenantId: string }, Querystring: { level?: string; status?: string; tree?: string } }>('/tenants/:tenantId/agents', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const tenantId = parseInt(request.params.tenantId);
      const { level, status, tree } = request.query;

      if (!canAccessTenant(user, tenantId)) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const where: any = { tenantId };
      if (level) where.level = parseInt(level);
      if (status) where.status = status;

      const agents = await prisma.agent.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, username: true, avatar: true } },
          parentAgent: { select: { id: true, name: true, code: true } },
          childAgents: tree === 'true' ? {
            include: {
              user: { select: { id: true, email: true, username: true } },
              childAgents: {
                include: {
                  user: { select: { id: true, email: true, username: true } }
                }
              }
            }
          } : false,
          _count: { select: { childAgents: true, orders: true } }
        },
        orderBy: [{ level: 'asc' }, { createdAt: 'desc' }]
      });

      return reply.send({ success: true, data: agents });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 获取单个代理详情
  fastify.get<{ Params: { tenantId: string; agentId: string } }>('/tenants/:tenantId/agents/:agentId', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const tenantId = parseInt(request.params.tenantId);
      const { agentId } = request.params;

      if (!canAccessTenant(user, tenantId)) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const agent = await prisma.agent.findFirst({
        where: { id: agentId, tenantId },
        include: {
          user: { select: { id: true, email: true, username: true, avatar: true } },
          parentAgent: { select: { id: true, name: true, code: true, level: true } },
          childAgents: {
            select: { id: true, name: true, code: true, level: true, status: true }
          },
          mallConfig: true,
          domains: true,
          _count: { select: { childAgents: true, orders: true } }
        }
      });

      if (!agent) {
        return reply.status(404).send({ success: false, error: 'Agent not found' });
      }

      return reply.send({ success: true, data: agent });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 更新代理状态
  fastify.put<{ Params: { tenantId: string; agentId: string } }>('/tenants/:tenantId/agents/:agentId/status', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const tenantId = parseInt(request.params.tenantId);
      const { agentId } = request.params;

      if (!canAccessTenant(user, tenantId)) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const validation = updateAgentStatusSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ success: false, error: validation.error.errors });
      }

      const agent = await prisma.agent.update({
        where: { id: agentId },
        data: { status: validation.data.status }
      });

      // 记录审计日志
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          action: 'UPDATE_AGENT_STATUS',
          module: 'agent',
          resourceId: agentId,
          newValues: JSON.stringify({ status: validation.data.status })
        }
      });

      return reply.send({ success: true, data: agent });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 获取代理业绩统计
  fastify.get<{ Params: { tenantId: string; agentId: string } }>('/tenants/:tenantId/agents/:agentId/stats', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const tenantId = parseInt(request.params.tenantId);
      const { agentId } = request.params;

      if (!canAccessTenant(user, tenantId)) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const agent = await prisma.agent.findFirst({
        where: { id: agentId, tenantId },
        select: {
          totalOrders: true,
          totalSales: true,
          totalCommission: true,
          availableBalance: true,
          pendingBalance: true
        }
      });

      if (!agent) {
        return reply.status(404).send({ success: false, error: 'Agent not found' });
      }

      // 获取最近30天的订单统计
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentOrders = await prisma.order.count({
        where: { agentId, createdAt: { gte: thirtyDaysAgo } }
      });

      const recentSales = await prisma.order.aggregate({
        where: { agentId, createdAt: { gte: thirtyDaysAgo }, paymentStatus: 'PAID' },
        _sum: { totalAmount: true }
      });

      return reply.send({
        success: true,
        data: {
          ...agent,
          recentOrders,
          recentSales: recentSales._sum.totalAmount || 0
        }
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // ============================================
  // 代理等级配置API
  // ============================================

  // 获取代理等级配置
  fastify.get<{ Params: { tenantId: string } }>('/tenants/:tenantId/levels', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const tenantId = parseInt(request.params.tenantId);

      if (!canAccessTenant(user, tenantId)) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const configs = await prisma.agentLevelConfig.findMany({
        where: { tenantId },
        orderBy: { level: 'asc' }
      });

      // 如果没有配置，返回默认配置
      if (configs.length === 0) {
        return reply.send({
          success: true,
          data: AGENT_LEVELS.map(level => ({
            level,
            commissionRate: level === 1 ? 10 : level === 2 ? 8 : 5,
            maxAgentsPerParent: 100,
            maxProducts: null,
            l1ShareRate: level === 1 ? 10 : null,
            l2ShareRate: level === 2 ? 8 : null,
            l3ShareRate: level === 3 ? 5 : null
          }))
        });
      }

      return reply.send({ success: true, data: configs });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 更新代理等级配置
  fastify.put<{ Params: { tenantId: string; level: string } }>('/tenants/:tenantId/levels/:level', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const tenantId = parseInt(request.params.tenantId);
      const level = parseInt(request.params.level);

      if (!canAccessTenant(user, tenantId)) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      if (!AGENT_LEVELS.includes(level as any)) {
        return reply.status(400).send({ success: false, error: 'Invalid level' });
      }

      const validation = updateAgentLevelConfigSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ success: false, error: validation.error.errors });
      }

      const config = await prisma.agentLevelConfig.upsert({
        where: { tenantId_level: { tenantId, level } },
        create: {
          tenant: { connect: { id: tenantId } },
          level,
          commissionRate: validation.data.commissionRate,
          maxAgentsPerParent: validation.data.maxAgentsPerParent,
          maxProducts: validation.data.maxProducts,
          l1ShareRate: validation.data.l1ShareRate,
          l2ShareRate: validation.data.l2ShareRate,
          l3ShareRate: validation.data.l3ShareRate
        },
        update: validation.data
      });

      return reply.send({ success: true, data: config });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // ============================================
  // Agent Mall配置API
  // ============================================

  // 获取代理Mall配置
  fastify.get<{ Params: { agentId: string } }>('/agents/:agentId/mall-config', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { agentId } = request.params;

      if (!(await canAccessAgent(user, agentId))) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const config = await prisma.agentMallConfig.findUnique({
        where: { agentId },
        include: {
          agent: { select: { tenantId: true, name: true, code: true } }
        }
      });

      if (!config) {
        return reply.status(404).send({ success: false, error: 'Mall config not found' });
      }

      return reply.send({ success: true, data: config });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 更新代理Mall配置
  fastify.put<{ Params: { agentId: string } }>('/agents/:agentId/mall-config', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { agentId } = request.params;

      if (!(await canAccessAgent(user, agentId))) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const validation = updateMallConfigSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ success: false, error: validation.error.errors });
      }

      const { themeSlug, themeConfig, settings, defaultDomainType } = validation.data;

      const config = await prisma.agentMallConfig.update({
        where: { agentId },
        data: {
          themeSlug,
          themeConfig: themeConfig ? JSON.stringify(themeConfig) : undefined,
          settings: settings ? JSON.stringify(settings) : undefined,
          defaultDomainType
        }
      });

      return reply.send({ success: true, data: config });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // ============================================
  // Agent域名管理API
  // ============================================

  // 获取代理域名列表
  fastify.get<{ Params: { agentId: string } }>('/agents/:agentId/domains', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { agentId } = request.params;

      if (!(await canAccessAgent(user, agentId))) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const domains = await prisma.agentDomain.findMany({
        where: { agentId },
        orderBy: { isPrimary: 'desc' }
      });

      return reply.send({ success: true, data: domains });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 添加代理域名
  fastify.post<{ Params: { agentId: string } }>('/agents/:agentId/domains', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { agentId } = request.params;

      if (!(await canAccessAgent(user, agentId))) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const validation = manageAgentDomainSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ success: false, error: validation.error.errors });
      }

      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { tenantId: true }
      });

      if (!agent) {
        return reply.status(404).send({ success: false, error: 'Agent not found' });
      }

      // 检查域名是否已被使用
      const existingDomain = await prisma.agentDomain.findUnique({
        where: { host: validation.data.host }
      });

      if (existingDomain) {
        return reply.status(409).send({ success: false, error: 'Domain already in use' });
      }

      const domain = await prisma.agentDomain.create({
        data: {
          agentId,
          tenantId: agent.tenantId,
          host: validation.data.host,
          isPrimary: validation.data.isPrimary || false
        }
      });

      return reply.status(201).send({ success: true, data: domain });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 删除代理域名
  fastify.delete<{ Params: { agentId: string; domainId: string } }>('/agents/:agentId/domains/:domainId', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { agentId, domainId } = request.params;

      if (!(await canAccessAgent(user, agentId))) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      await prisma.agentDomain.delete({
        where: { id: domainId, agentId }
      });

      return reply.send({ success: true, message: 'Domain deleted' });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // ============================================
  // BYOK配置API（预留，第一阶段仅支持读取/更新配置）
  // ============================================

  // 获取代理BYOK配置
  fastify.get<{ Params: { agentId: string } }>('/agents/:agentId/byok-config', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { agentId } = request.params;

      if (!(await canAccessAgent(user, agentId))) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const config = await prisma.agentMallConfig.findUnique({
        where: { agentId },
        select: {
          id: true,
          agentId: true,
          byokConfig: true,
          agent: {
            select: {
              tenantId: true,
              tenant: {
                select: {
                  companyName: true
                }
              }
            }
          }
        }
      });

      if (!config) {
        return reply.status(404).send({ success: false, error: 'BYOK config not found' });
      }

      // 解析BYOK配置
      const byokConfig = config.byokConfig ? JSON.parse(config.byokConfig) : null;

      return reply.send({
        success: true,
        data: {
          agentId: config.agentId,
          tenantId: config.agent.tenantId,
          tenantName: config.agent.tenant.companyName,
          byokConfig,
          // 第一阶段：BYOK功能未启用，所有支付走租户配置
          byokEnabled: false,
          message: 'BYOK feature is reserved for future use. All payments currently use tenant configuration.'
        }
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 更新代理BYOK配置（预留接口，第一阶段仅保存配置不生效）
  fastify.put<{ Params: { agentId: string } }>('/agents/:agentId/byok-config', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { agentId } = request.params;

      if (!(await canAccessAgent(user, agentId))) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const body = request.body as any;

      // 验证BYOK配置结构（预留字段）
      const byokConfig = {
        stripeAccountId: body.stripeAccountId || null,
        paymentMethods: body.paymentMethods || [],
        enabledAt: body.stripeAccountId ? new Date().toISOString() : null,
        notes: body.notes || null
      };

      await prisma.agentMallConfig.update({
        where: { agentId },
        data: {
          byokConfig: JSON.stringify(byokConfig)
        }
      });

      return reply.send({
        success: true,
        data: {
          byokConfig,
          // 第一阶段：配置已保存但未生效
          byokEnabled: false,
          message: 'BYOK configuration saved. Feature will be enabled in a future release.'
        }
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // ============================================
  // 佣金API
  // ============================================

  // 获取租户的代理佣金列表
  fastify.get<{ Params: { tenantId: string }, Querystring: { status?: string; page?: string; limit?: string } }>('/tenants/:tenantId/commissions', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const tenantId = parseInt(request.params.tenantId);
      const { status, page = '1', limit = '20' } = request.query;

      if (!canAccessTenant(user, tenantId)) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const where: any = { tenantId };
      if (status) where.status = status;

      const [commissions, total] = await Promise.all([
        prisma.agentCommission.findMany({
          where,
          include: {
            agent: { select: { id: true, name: true, code: true, level: true } },
            order: { select: { id: true, totalAmount: true, createdAt: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip: (parseInt(page) - 1) * parseInt(limit),
          take: parseInt(limit)
        }),
        prisma.agentCommission.count({ where })
      ]);

      return reply.send({
        success: true,
        data: commissions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 获取代理的佣金列表
  fastify.get<{ Params: { agentId: string }, Querystring: { status?: string; page?: string; limit?: string } }>('/agents/:agentId/commissions', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { agentId } = request.params;
      const { status, page = '1', limit = '20' } = request.query;

      if (!(await canAccessAgent(user, agentId))) {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const where: any = { agentId };
      if (status) where.status = status;

      const [commissions, total] = await Promise.all([
        prisma.agentCommission.findMany({
          where,
          include: {
            order: { select: { id: true, totalAmount: true, createdAt: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip: (parseInt(page) - 1) * parseInt(limit),
          take: parseInt(limit)
        }),
        prisma.agentCommission.count({ where })
      ]);

      return reply.send({
        success: true,
        data: commissions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // ============================================
  // Super Admin API
  // ============================================

  // 获取全平台代理概览
  fastify.get('/super-admin/overview', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;

      if (user.role !== 'SUPER_ADMIN') {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const [
        totalAgents,
        activeAgents,
        totalTenants,
        tenantsWithAgents,
        totalCommissions,
        totalCommissionAmount
      ] = await Promise.all([
        prisma.agent.count(),
        prisma.agent.count({ where: { status: 'ACTIVE' } }),
        prisma.tenant.count(),
        prisma.tenant.count({
          where: { agents: { some: {} } }
        }),
        prisma.agentCommission.count(),
        prisma.agentCommission.aggregate({
          _sum: { amount: true }
        })
      ]);

      // 按等级统计
      const agentsByLevel = await prisma.agent.groupBy({
        by: ['level'],
        _count: { id: true }
      });

      return reply.send({
        success: true,
        data: {
          totalAgents,
          activeAgents,
          totalTenants,
          tenantsWithAgents,
          totalCommissions,
          totalCommissionAmount: totalCommissionAmount._sum.amount || 0,
          agentsByLevel: agentsByLevel.reduce((acc, item) => {
            acc[`L${item.level}`] = item._count.id;
            return acc;
          }, {} as Record<string, number>)
        }
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 获取所有租户的代理列表
  fastify.get<{ Querystring: { tenantId?: string; page?: string; limit?: string } }>('/super-admin/tenants/agents', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { tenantId, page = '1', limit = '20' } = request.query;

      if (user.role !== 'SUPER_ADMIN') {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const where: any = {};
      if (tenantId) where.tenantId = parseInt(tenantId);

      const [agents, total] = await Promise.all([
        prisma.agent.findMany({
          where,
          include: {
            tenant: { select: { id: true, companyName: true } },
            user: { select: { id: true, email: true, username: true } },
            _count: { select: { childAgents: true, orders: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip: (parseInt(page) - 1) * parseInt(limit),
          take: parseInt(limit)
        }),
        prisma.agent.count({ where })
      ]);

      return reply.send({
        success: true,
        data: agents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 许可证管理 - 获取所有代理插件许可证
  fastify.get('/super-admin/licenses', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;

      if (user.role !== 'SUPER_ADMIN') {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      const licenses = await prisma.pluginLicense.findMany({
        where: { plugin: { slug: 'agent' } },
        include: {
          tenant: { select: { id: true, companyName: true } },
          plugin: { select: { id: true, name: true, slug: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send({ success: true, data: licenses });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 激活租户的代理插件许可证
  fastify.post<{ Params: { tenantId: string } }>('/super-admin/licenses/:tenantId/activate', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const tenantId = parseInt(request.params.tenantId);

      if (user.role !== 'SUPER_ADMIN') {
        return reply.status(403).send({ success: false, error: 'Forbidden' });
      }

      // 获取agent插件
      const plugin = await prisma.plugin.findUnique({
        where: { slug: 'agent' }
      });

      if (!plugin) {
        return reply.status(404).send({ success: false, error: 'Agent plugin not found' });
      }

      // 创建或更新许可证
      const license = await prisma.pluginLicense.upsert({
        where: { tenantId_pluginId: { tenantId, pluginId: plugin.id } },
        create: {
          tenantId,
          pluginId: plugin.id,
          status: 'ACTIVE',
          activatedAt: new Date(),
          amount: 0 // 目前免费
        },
        update: {
          status: 'ACTIVE',
          activatedAt: new Date()
        }
      });

      // 确保插件安装记录存在
      await prisma.pluginInstallation.upsert({
        where: { tenantId_pluginId: { tenantId, pluginId: plugin.id } },
        create: {
          tenantId,
          pluginId: plugin.id,
          status: 'ACTIVE',
          enabled: true
        },
        update: {
          status: 'ACTIVE',
          enabled: true
        }
      });

      // 创建默认代理等级配置
      for (const level of AGENT_LEVELS) {
        await prisma.agentLevelConfig.upsert({
          where: { tenantId_level: { tenantId, level } },
          create: {
            tenantId,
            level,
            commissionRate: level === 1 ? 10 : level === 2 ? 8 : 5,
            maxAgentsPerParent: 100,
            l1ShareRate: 3,
            l2ShareRate: 2,
            l3ShareRate: 0
          },
          update: {}
        });
      }

      // 审计日志
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          action: 'ACTIVATE_AGENT_LICENSE',
          module: 'plugins',
          resourceId: license.id,
          newValues: JSON.stringify({ status: 'ACTIVE' })
        }
      });

      return reply.send({ success: true, data: license });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // ============================================
  // 🆕 Self路径配置API - 自己商城的变体可售性和价格
  // ============================================

  // 获取商品下所有变体的Self配置
  fastify.get<{ Params: { productId: string }, Querystring: { ownerType?: string; ownerId?: string } }>('/self/products/:productId/variants', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { productId } = request.params;
      const { ownerType: queryOwnerType, ownerId: queryOwnerId } = request.query;

      // 确定ownerType和ownerId
      let ownerType: 'TENANT' | 'AGENT';
      let ownerId: string;
      let tenantId: number;

      if (user.role === 'TENANT_ADMIN') {
        tenantId = user.tenantId;
        ownerType = queryOwnerType === 'AGENT' && queryOwnerId ? 'AGENT' : 'TENANT';
        ownerId = ownerType === 'TENANT' ? tenantId.toString() : queryOwnerId!;
      } else if (user.role === 'SUPER_ADMIN') {
        // Super admin must specify tenant
        if (!queryOwnerId) {
          return reply.status(400).send({ success: false, error: 'ownerId required for super admin' });
        }
        ownerType = (queryOwnerType as 'TENANT' | 'AGENT') || 'TENANT';
        ownerId = queryOwnerId;
        // Get tenantId from owner
        if (ownerType === 'AGENT') {
          const agent = await prisma.agent.findUnique({ where: { id: ownerId }, select: { tenantId: true } });
          if (!agent) return reply.status(404).send({ success: false, error: 'Agent not found' });
          tenantId = agent.tenantId;
        } else {
          tenantId = parseInt(ownerId);
        }
      } else {
        // Regular user - check if they are an agent
        const agent = await prisma.agent.findFirst({
          where: { userId: user.id, status: 'ACTIVE' }
        });
        if (!agent) {
          return reply.status(403).send({ success: false, error: 'Forbidden' });
        }
        tenantId = agent.tenantId;
        ownerType = 'AGENT';
        ownerId = agent.id;
      }

      // Get Self variant configs
      const configs = await AgentAuthorizationService.getSelfVariantConfig({
        tenantId,
        ownerType,
        ownerId,
        productId
      });

      // Get variant details
      const variants = await prisma.productVariant.findMany({
        where: { productId, tenantId },
        include: { product: { select: { name: true } } }
      });

      const result = variants.map(v => ({
        variantId: v.id,
        variantName: v.name,
        productName: v.product.name,
        basePrice: v.basePrice,
        ...configs.get(v.id)
      }));

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      fastify.log.error('Failed to get self variant configs:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 更新变体的Self配置
  fastify.put<{ Params: { variantId: string } }>('/self/variants/:variantId', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { variantId } = request.params;
      const body = request.body as { canSellSelf?: boolean; selfPrice?: number | null; ownerType?: string; ownerId?: string };

      // Get variant info
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, productId: true, tenantId: true }
      });

      if (!variant) {
        return reply.status(404).send({ success: false, error: 'Variant not found' });
      }

      // Determine owner
      let ownerType: 'TENANT' | 'AGENT';
      let ownerId: string;

      if (user.role === 'TENANT_ADMIN') {
        if (!canAccessTenant(user, variant.tenantId)) {
          return reply.status(403).send({ success: false, error: 'Forbidden' });
        }
        ownerType = body.ownerType === 'AGENT' && body.ownerId ? 'AGENT' : 'TENANT';
        ownerId = ownerType === 'TENANT' ? variant.tenantId.toString() : body.ownerId!;
      } else if (user.role === 'SUPER_ADMIN') {
        ownerType = (body.ownerType as 'TENANT' | 'AGENT') || 'TENANT';
        ownerId = body.ownerId || variant.tenantId.toString();
      } else {
        const agent = await prisma.agent.findFirst({
          where: { userId: user.id, tenantId: variant.tenantId, status: 'ACTIVE' }
        });
        if (!agent) {
          return reply.status(403).send({ success: false, error: 'Forbidden' });
        }
        ownerType = 'AGENT';
        ownerId = agent.id;
      }

      // Upsert Self config
      const config = await prisma.agentVariantSelfConfig.upsert({
        where: {
          tenantId_ownerType_ownerId_variantId: {
            tenantId: variant.tenantId,
            ownerType,
            ownerId,
            variantId
          }
        },
        create: {
          tenantId: variant.tenantId,
          ownerType,
          ownerId,
          productId: variant.productId,
          variantId,
          canSellSelf: body.canSellSelf ?? true,
          selfPrice: body.selfPrice ?? null
        },
        update: {
          canSellSelf: body.canSellSelf,
          selfPrice: body.selfPrice
        }
      });

      return reply.send({ success: true, data: config });
    } catch (error: any) {
      fastify.log.error('Failed to update self variant config:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // ============================================
  // 🆕 Children路径配置API - 给下级代理的授权和价格
  // ============================================

  // 获取商品下所有变体的Children配置
  fastify.get<{ Params: { productId: string }, Querystring: { ownerType?: string; ownerId?: string } }>('/children/products/:productId/variants', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { productId } = request.params;
      const { ownerType: queryOwnerType, ownerId: queryOwnerId } = request.query;

      // 确定ownerType和ownerId
      let ownerType: 'TENANT' | 'AGENT';
      let ownerId: string;
      let tenantId: number;

      if (user.role === 'TENANT_ADMIN') {
        tenantId = user.tenantId;
        ownerType = queryOwnerType === 'AGENT' && queryOwnerId ? 'AGENT' : 'TENANT';
        ownerId = ownerType === 'TENANT' ? tenantId.toString() : queryOwnerId!;
      } else if (user.role === 'SUPER_ADMIN') {
        if (!queryOwnerId) {
          return reply.status(400).send({ success: false, error: 'ownerId required for super admin' });
        }
        ownerType = (queryOwnerType as 'TENANT' | 'AGENT') || 'TENANT';
        ownerId = queryOwnerId;
        if (ownerType === 'AGENT') {
          const agent = await prisma.agent.findUnique({ where: { id: ownerId }, select: { tenantId: true } });
          if (!agent) return reply.status(404).send({ success: false, error: 'Agent not found' });
          tenantId = agent.tenantId;
        } else {
          tenantId = parseInt(ownerId);
        }
      } else {
        const agent = await prisma.agent.findFirst({
          where: { userId: user.id, status: 'ACTIVE' }
        });
        if (!agent) {
          return reply.status(403).send({ success: false, error: 'Forbidden' });
        }
        tenantId = agent.tenantId;
        ownerType = 'AGENT';
        ownerId = agent.id;
      }

      // Get Children variant configs
      const configs = await AgentAuthorizationService.getChildrenVariantConfig({
        tenantId,
        ownerType,
        ownerId,
        productId
      });

      // Get variant details
      const variants = await prisma.productVariant.findMany({
        where: { productId, tenantId },
        include: { product: { select: { name: true, agentCanDelegate: true } } }
      });

      const result = variants.map(v => ({
        variantId: v.id,
        variantName: v.name,
        productName: v.product.name,
        basePrice: v.basePrice,
        productAgentCanDelegate: v.product.agentCanDelegate,
        variantAgentCanDelegate: v.agentCanDelegate,
        ...configs.get(v.id)
      }));

      return reply.send({ success: true, data: result });
    } catch (error: any) {
      fastify.log.error('Failed to get children variant configs:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 更新商品级Children配置
  fastify.put<{ Params: { productId: string } }>('/children/products/:productId', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { productId } = request.params;
      const body = request.body as { canDelegateProduct?: boolean; ownerType?: string; ownerId?: string };

      // Get product info
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, tenantId: true }
      });

      if (!product) {
        return reply.status(404).send({ success: false, error: 'Product not found' });
      }

      // Determine owner
      let ownerType: 'TENANT' | 'AGENT';
      let ownerId: string;

      if (user.role === 'TENANT_ADMIN') {
        if (!canAccessTenant(user, product.tenantId)) {
          return reply.status(403).send({ success: false, error: 'Forbidden' });
        }
        ownerType = body.ownerType === 'AGENT' && body.ownerId ? 'AGENT' : 'TENANT';
        ownerId = ownerType === 'TENANT' ? product.tenantId.toString() : body.ownerId!;
      } else if (user.role === 'SUPER_ADMIN') {
        ownerType = (body.ownerType as 'TENANT' | 'AGENT') || 'TENANT';
        ownerId = body.ownerId || product.tenantId.toString();
      } else {
        const agent = await prisma.agent.findFirst({
          where: { userId: user.id, tenantId: product.tenantId, status: 'ACTIVE' }
        });
        if (!agent) {
          return reply.status(403).send({ success: false, error: 'Forbidden' });
        }
        ownerType = 'AGENT';
        ownerId = agent.id;
      }

      // Upsert Children config (product-level, variantId = null)
      // 🔧 使用 findFirst + create/update 替代 upsert，因为 Prisma upsert 对 nullable 唯一字段处理有问题
      const existingConfig = await prisma.agentVariantChildrenConfig.findFirst({
        where: {
          tenantId: product.tenantId,
          ownerType,
          ownerId,
          productId,
          variantId: null // 商品级配置，variantId 为 null
        }
      });

      let config;
      if (existingConfig) {
        // Update existing config
        config = await prisma.agentVariantChildrenConfig.update({
          where: { id: existingConfig.id },
          data: {
            canDelegateProduct: body.canDelegateProduct
          }
        });
      } else {
        // Create new config
        config = await prisma.agentVariantChildrenConfig.create({
          data: {
            tenantId: product.tenantId,
            ownerType,
            ownerId,
            productId,
            variantId: null,
            canDelegateProduct: body.canDelegateProduct ?? true,
            canDelegateVariant: true
          }
        });
      }

      return reply.send({ success: true, data: config });
    } catch (error: any) {
      fastify.log.error('Failed to update children product config:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });

  // 更新变体级Children配置
  fastify.put<{ Params: { variantId: string } }>('/children/variants/:variantId', {
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { variantId } = request.params;
      const body = request.body as {
        canDelegateVariant?: boolean;
        priceForChildren?: number | null;
        priceForChildrenMin?: number | null;
        priceForChildrenMax?: number | null;
        ownerType?: string;
        ownerId?: string;
      };

      // Get variant info
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, productId: true, tenantId: true }
      });

      if (!variant) {
        return reply.status(404).send({ success: false, error: 'Variant not found' });
      }

      // Determine owner
      let ownerType: 'TENANT' | 'AGENT';
      let ownerId: string;

      if (user.role === 'TENANT_ADMIN') {
        if (!canAccessTenant(user, variant.tenantId)) {
          return reply.status(403).send({ success: false, error: 'Forbidden' });
        }
        ownerType = body.ownerType === 'AGENT' && body.ownerId ? 'AGENT' : 'TENANT';
        ownerId = ownerType === 'TENANT' ? variant.tenantId.toString() : body.ownerId!;
      } else if (user.role === 'SUPER_ADMIN') {
        ownerType = (body.ownerType as 'TENANT' | 'AGENT') || 'TENANT';
        ownerId = body.ownerId || variant.tenantId.toString();
      } else {
        const agent = await prisma.agent.findFirst({
          where: { userId: user.id, tenantId: variant.tenantId, status: 'ACTIVE' }
        });
        if (!agent) {
          return reply.status(403).send({ success: false, error: 'Forbidden' });
        }
        ownerType = 'AGENT';
        ownerId = agent.id;
      }

      // Upsert Children config (variant-level)
      const config = await prisma.agentVariantChildrenConfig.upsert({
        where: {
          tenantId_ownerType_ownerId_productId_variantId: {
            tenantId: variant.tenantId,
            ownerType,
            ownerId,
            productId: variant.productId,
            variantId
          }
        },
        create: {
          tenantId: variant.tenantId,
          ownerType,
          ownerId,
          productId: variant.productId,
          variantId,
          canDelegateProduct: true,
          canDelegateVariant: body.canDelegateVariant ?? true,
          priceForChildren: body.priceForChildren ?? null,
          priceForChildrenMin: body.priceForChildrenMin ?? null,
          priceForChildrenMax: body.priceForChildrenMax ?? null
        },
        update: {
          canDelegateVariant: body.canDelegateVariant,
          priceForChildren: body.priceForChildren,
          priceForChildrenMin: body.priceForChildrenMin,
          priceForChildrenMax: body.priceForChildrenMax
        }
      });

      return reply.send({ success: true, data: config });
    } catch (error: any) {
      fastify.log.error('Failed to update children variant config:', error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  });
};

export default agentPlugin;

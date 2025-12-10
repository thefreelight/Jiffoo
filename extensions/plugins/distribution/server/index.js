/**
 * Distribution System Plugin
 * 
 * 分销系统插件 - 提供多级分销功能：
 * - 代理管理（注册、审核、层级）
 * - 佣金计算和分润
 * - 自动结算
 * - 分销数据统计
 */

const fp = require('fastify-plugin');

async function distributionPlugin(fastify, options) {
  const {
    maxAgentLevel = 3,
    defaultCommissionRate = 0.1,
    autoSettlement = true,
    settlementCycle = 'monthly',
  } = options;

  // ============================================
  // 代理管理 API
  // ============================================

  // 获取代理列表
  fastify.get('/agents', async (request, reply) => {
    const { page = 1, limit = 20, status, level } = request.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const where = {};
    if (status) where.status = status;
    if (level) where.level = parseInt(level);
    
    const [agents, total] = await Promise.all([
      fastify.prisma.agent.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      fastify.prisma.agent.count({ where }),
    ]);
    
    return {
      success: true,
      data: { agents, total, page: parseInt(page), limit: parseInt(limit) },
    };
  });

  // 申请成为代理
  fastify.post('/agents/apply', async (request, reply) => {
    const { userId, referralCode, documents } = request.body;
    
    // 检查用户是否已是代理
    const existingAgent = await fastify.prisma.agent.findFirst({ where: { userId } });
    if (existingAgent) {
      return reply.status(400).send({
        success: false, error: 'ALREADY_AGENT',
        message: 'User is already an agent',
      });
    }

    // 查找推荐人
    let parentAgent = null;
    if (referralCode) {
      parentAgent = await fastify.prisma.agent.findFirst({ where: { referralCode } });
      if (parentAgent && parentAgent.level >= maxAgentLevel) {
        return reply.status(400).send({
          success: false, error: 'MAX_LEVEL_REACHED',
          message: `Maximum agent level (${maxAgentLevel}) reached`,
        });
      }
    }

    const agent = await fastify.prisma.agent.create({
      data: {
        userId,
        parentId: parentAgent?.id || null,
        level: parentAgent ? parentAgent.level + 1 : 1,
        status: 'PENDING',
        commissionRate: defaultCommissionRate,
        referralCode: generateReferralCode(),
        documents: documents || {},
      },
    });

    return { success: true, data: { agent } };
  });

  // 审核代理申请
  fastify.post('/agents/:id/review', async (request, reply) => {
    const { id } = request.params;
    const { status, reason } = request.body;
    
    const agent = await fastify.prisma.agent.update({
      where: { id: parseInt(id) },
      data: { status, reviewReason: reason, reviewedAt: new Date() },
    });
    
    return { success: true, data: { agent } };
  });

  // ============================================
  // 佣金管理 API
  // ============================================

  // 获取佣金记录
  fastify.get('/commissions', async (request, reply) => {
    const { page = 1, limit = 20, agentId, status } = request.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const where = {};
    if (agentId) where.agentId = parseInt(agentId);
    if (status) where.status = status;
    
    const [commissions, total] = await Promise.all([
      fastify.prisma.commission.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: { agent: true, order: { select: { id: true, orderNumber: true, totalAmount: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      fastify.prisma.commission.count({ where }),
    ]);
    
    return {
      success: true,
      data: { commissions, total, page: parseInt(page), limit: parseInt(limit) },
    };
  });

  // 计算订单佣金
  fastify.post('/commissions/calculate', async (request, reply) => {
    const { orderId } = request.body;
    
    const order = await fastify.prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: { user: true },
    });
    
    if (!order) {
      return reply.status(404).send({ success: false, error: 'ORDER_NOT_FOUND' });
    }

    // 查找用户的推荐代理链
    const commissions = await calculateCommissionChain(fastify, order, maxAgentLevel, defaultCommissionRate);
    
    return { success: true, data: { commissions } };
  });

  // ============================================
  // 结算管理 API
  // ============================================

  // 获取结算记录
  fastify.get('/settlements', async (request, reply) => {
    const { page = 1, limit = 20, agentId, status } = request.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const where = {};
    if (agentId) where.agentId = parseInt(agentId);
    if (status) where.status = status;
    
    const [settlements, total] = await Promise.all([
      fastify.prisma.settlement.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: { agent: true },
        orderBy: { createdAt: 'desc' },
      }),
      fastify.prisma.settlement.count({ where }),
    ]);
    
    return {
      success: true,
      data: { settlements, total, page: parseInt(page), limit: parseInt(limit) },
    };
  });

  // 创建结算
  fastify.post('/settlements', async (request, reply) => {
    const { agentId, amount, method } = request.body;
    
    const settlement = await fastify.prisma.settlement.create({
      data: {
        agentId: parseInt(agentId),
        amount,
        method,
        status: 'PENDING',
      },
    });
    
    return { success: true, data: { settlement } };
  });

  // 获取插件配置
  fastify.get('/config', async (request, reply) => {
    return {
      success: true,
      data: {
        maxAgentLevel,
        defaultCommissionRate,
        autoSettlement,
        settlementCycle,
      },
    };
  });
}

// 辅助函数：生成推荐码
function generateReferralCode() {
  return 'REF' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// 辅助函数：计算佣金链
async function calculateCommissionChain(fastify, order, maxLevel, defaultRate) {
  const commissions = [];
  // 简化实现 - 实际应该遍历代理链
  return commissions;
}

module.exports = fp(distributionPlugin, {
  name: 'distribution-plugin',
  fastify: '5.x',
});

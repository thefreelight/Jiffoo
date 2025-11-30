/**
 * Affiliate Plugin - 分销分润插件
 *
 * 提供分销分润功能：
 * - 邀请码生成和管理
 * - 佣金计算和追踪
 * - 提现申请和处理
 * - 许可证管理
 * - Super Admin管理功能
 *
 * 注意：此插件不使用 fastify-plugin 包装，保持封装以避免路由泄露
 * 符合Fastify官方最佳实践，与Stripe、Google OAuth、Resend保持一致
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '@/core/auth/middleware';
import { z } from 'zod';
import { prisma } from '@/config/database';

// ============================================
// 权限检查中间件
// ============================================

/**
 * 租户管理员权限检查中间件
 * 用于检查用户是否为 TENANT_ADMIN 或 SUPER_ADMIN
 */
async function requireTenantAdminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = (request as any).user;

  if (!user) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  if (user.role !== 'TENANT_ADMIN' && user.role !== 'SUPER_ADMIN') {
    return reply.status(403).send({
      success: false,
      error: 'Forbidden',
      message: 'Tenant admin access required'
    });
  }
}

/**
 * 超级管理员权限检查中间件
 * 用于检查用户是否为 SUPER_ADMIN
 */
async function requireSuperAdminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = (request as any).user;

  if (!user) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  if (user.role !== 'SUPER_ADMIN') {
    return reply.status(403).send({
      success: false,
      error: 'Forbidden',
      message: 'Super admin access required'
    });
  }
}

/**
 * Affiliate 许可证检查中间件工厂
 * 用于检查租户是否已购买 Affiliate 插件许可证
 */
function createAffiliateLicenseCheckMiddleware(fastify: any) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = (request as any).user?.tenantId;

    if (!tenantId) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Tenant context required'
      });
    }

    try {
      const licenseCheck = await fastify.checkAffiliateLicense(tenantId);

      if (!licenseCheck.valid) {
        return reply.status(403).send({
          success: false,
          error: 'License required',
          message: licenseCheck.message,
          upgradeUrl: licenseCheck.upgradeUrl
        });
      }
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: 'License check failed',
        message: error.message
      });
    }
  };
}

// ============================================
// 类型定义
// ============================================

// 佣金状态枚举
const CommissionStatus = {
  PENDING: 'PENDING',       // 待结算（7天内）
  SETTLED: 'SETTLED',       // 已结算（可提现）
  PAID: 'PAID',            // 已支付
  REFUNDED: 'REFUNDED'     // 已退款
} as const;

type CommissionStatusType = typeof CommissionStatus[keyof typeof CommissionStatus];

// 提现状态枚举
const PayoutStatus = {
  PENDING: 'PENDING',       // 待处理
  PROCESSING: 'PROCESSING', // 处理中
  COMPLETED: 'COMPLETED',   // 已完成
  FAILED: 'FAILED',        // 失败
  CANCELLED: 'CANCELLED'   // 已取消
} as const;

type PayoutStatusType = typeof PayoutStatus[keyof typeof PayoutStatus];

// 提现方式枚举
const PayoutMethod = {
  BANK_TRANSFER: 'BANK_TRANSFER',
  PAYPAL: 'PAYPAL',
  ALIPAY: 'ALIPAY',
  WECHAT: 'WECHAT'
} as const;

type PayoutMethodType = typeof PayoutMethod[keyof typeof PayoutMethod];

// Zod Schema定义
const UpdateCommissionConfigSchema = z.object({
  enabled: z.boolean().optional(),
  defaultRate: z.number().min(0).max(100).optional(),
  settlementDays: z.number().int().min(1).max(30).optional(),
  minPayoutAmount: z.number().min(0).optional(),
});

type UpdateCommissionConfigRequest = z.infer<typeof UpdateCommissionConfigSchema>;

const UpdateUserCommissionRateSchema = z.object({
  rate: z.number().min(0).max(100).nullable(),
});

type UpdateUserCommissionRateRequest = z.infer<typeof UpdateUserCommissionRateSchema>;

const RequestPayoutSchema = z.object({
  amount: z.number().min(0),
  method: z.enum(['BANK_TRANSFER', 'PAYPAL', 'ALIPAY', 'WECHAT']),
  accountInfo: z.object({
    accountName: z.string().optional(),
    accountNumber: z.string().optional(),
    bankName: z.string().optional(),
    email: z.string().email().optional(),
  }),
});

type RequestPayoutRequest = z.infer<typeof RequestPayoutSchema>;

const ProcessPayoutSchema = z.object({
  status: z.enum(['COMPLETED', 'FAILED', 'CANCELLED']),
  failureReason: z.string().optional(),
  note: z.string().optional(),
});

type ProcessPayoutRequest = z.infer<typeof ProcessPayoutSchema>;

// 接口定义
interface CommissionConfigResponse {
  id: string;
  tenantId: number;
  enabled: boolean;
  defaultRate: number;
  settlementDays: number;
  minPayoutAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CommissionResponse {
  id: string;
  tenantId: number;
  userId: string;
  orderId: string;
  buyerId: string;
  orderAmount: number;
  rate: number;
  amount: number;
  status: CommissionStatusType;
  settleAt: Date;
  settledAt: Date | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: string; username: string; email: string };
  buyer?: { id: string; username: string; email: string };
  order?: { id: string; totalAmount: number; status: string };
}

interface PayoutResponse {
  id: string;
  tenantId: number;
  userId: string;
  amount: number;
  currency: string;
  status: PayoutStatusType;
  method: PayoutMethodType | null;
  accountInfo: string | null;
  processedAt: Date | null;
  processedBy: string | null;
  failureReason: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: string; username: string; email: string };
}

interface AffiliateStatsResponse {
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  totalReferrals: number;
  totalCommissions: number;
  pendingCommissions: number;
  settledCommissions: number;
  paidCommissions: number;
}

interface PaginationParams {
  page?: number;
  limit?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

interface PaginationResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CommissionsListResponse {
  commissions: CommissionResponse[];
  pagination: PaginationResponse;
}

interface PayoutsListResponse {
  payouts: PayoutResponse[];
  pagination: PaginationResponse;
}

// ============================================
// 业务逻辑方法
// ============================================

/**
 * 生成唯一邀请码
 */
async function generateReferralCode(): Promise<string> {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  let isUnique = false;

  while (!isUnique) {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    const existing = await prisma.user.findUnique({
      where: { referralCode: code }
    });

    if (!existing) {
      isUnique = true;
    }
  }

  return code;
}

/**
 * 为用户生成邀请码（如果还没有）
 */
async function ensureReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true }
  });

  if (user?.referralCode) {
    return user.referralCode;
  }

  const code = await generateReferralCode();
  await prisma.user.update({
    where: { id: userId },
    data: { referralCode: code }
  });

  return code;
}

/**
 * 通过邀请码获取用户ID
 */
async function getUserIdByReferralCode(code: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true }
  });

  return user?.id || null;
}

/**
 * 订单支付成功后计算佣金
 */
async function calculateCommission(orderId: string, tenantId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          id: true,
          invitedBy: true
        }
      }
    }
  });

  if (!order) {
    throw new Error('Order not found');
  }

  if (order.commissionCalculated) {
    return;
  }

  const config = await prisma.tenantCommissionConfig.findUnique({
    where: { tenantId }
  });

  if (!config?.enabled) {
    await prisma.order.update({
      where: { id: orderId },
      data: { commissionCalculated: true }
    });
    return;
  }

  const buyer = order.user;
  if (!buyer.invitedBy) {
    await prisma.order.update({
      where: { id: orderId },
      data: { commissionCalculated: true }
    });
    return;
  }

  const referrer = await prisma.user.findUnique({
    where: { id: buyer.invitedBy },
    select: {
      id: true,
      customCommissionRate: true
    }
  });

  if (!referrer) {
    await prisma.order.update({
      where: { id: orderId },
      data: { commissionCalculated: true }
    });
    return;
  }

  const rate = referrer.customCommissionRate ?? config.defaultRate;
  const amount = order.totalAmount * (rate / 100);
  const settleAt = new Date(Date.now() + config.settlementDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.commission.create({
      data: {
        tenantId,
        userId: referrer.id,
        orderId: order.id,
        buyerId: buyer.id,
        orderAmount: order.totalAmount,
        rate,
        amount,
        status: CommissionStatus.PENDING,
        settleAt
      }
    }),

    prisma.user.update({
      where: { id: referrer.id },
      data: {
        pendingBalance: { increment: amount },
        totalEarnings: { increment: amount }
      }
    }),

    prisma.order.update({
      where: { id: orderId },
      data: {
        commissionCalculated: true,
        referrerId: referrer.id
      }
    })
  ]);
}

/**
 * 定时任务：结算到期的佣金
 */
async function settlePendingCommissions(): Promise<number> {
  const now = new Date();

  const pendingCommissions = await prisma.commission.findMany({
    where: {
      status: CommissionStatus.PENDING,
      settleAt: { lte: now }
    }
  });

  let settledCount = 0;

  for (const commission of pendingCommissions) {
    try {
      await prisma.$transaction([
        prisma.commission.update({
          where: { id: commission.id },
          data: {
            status: CommissionStatus.SETTLED,
            settledAt: now
          }
        }),

        prisma.user.update({
          where: { id: commission.userId },
          data: {
            pendingBalance: { decrement: commission.amount },
            availableBalance: { increment: commission.amount }
          }
        })
      ]);

      settledCount++;
    } catch (error) {
      console.error(`Failed to settle commission ${commission.id}:`, error);
    }
  }

  return settledCount;
}

/**
 * 订单退款后扣除佣金
 */
async function handleOrderRefund(orderId: string): Promise<void> {
  const commission = await prisma.commission.findFirst({
    where: {
      orderId,
      status: { in: [CommissionStatus.PENDING, CommissionStatus.SETTLED] }
    }
  });

  if (!commission) {
    return;
  }

  await prisma.$transaction([
    prisma.commission.update({
      where: { id: commission.id },
      data: {
        status: CommissionStatus.REFUNDED,
        refundedAt: new Date()
      }
    }),

    prisma.user.update({
      where: { id: commission.userId },
      data: {
        ...(commission.status === CommissionStatus.PENDING
          ? { pendingBalance: { decrement: commission.amount } }
          : { availableBalance: { decrement: commission.amount } }
        ),
        totalEarnings: { decrement: commission.amount }
      }
    })
  ]);
}

/**
 * 获取用户的分销统计
 */
async function getUserStats(userId: string, tenantId: number): Promise<AffiliateStatsResponse> {
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      totalEarnings: true,
      availableBalance: true,
      pendingBalance: true,
      totalReferrals: true
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  const settledCommissions = await prisma.commission.findMany({
    where: {
      userId,
      tenantId,
      status: CommissionStatus.PENDING,
      settleAt: { lte: now }
    },
    select: { amount: true }
  });

  const withdrawableAmount = settledCommissions.reduce((sum, c) => sum + c.amount, 0);

  const [totalCommissions, pendingCommissions, settledCommissions_count, paidCommissions] = await Promise.all([
    prisma.commission.count({ where: { userId, tenantId } }),
    prisma.commission.count({ where: { userId, tenantId, status: CommissionStatus.PENDING } }),
    prisma.commission.count({ where: { userId, tenantId, status: CommissionStatus.SETTLED } }),
    prisma.commission.count({ where: { userId, tenantId, status: CommissionStatus.PAID } })
  ]);

  return {
    totalEarnings: user.totalEarnings,
    availableBalance: withdrawableAmount,
    pendingBalance: user.pendingBalance,
    totalReferrals: user.totalReferrals,
    totalCommissions,
    pendingCommissions,
    settledCommissions: settledCommissions_count,
    paidCommissions
  };
}

/**
 * 获取用户的佣金记录列表
 */
async function getUserCommissions(
  userId: string,
  tenantId: number,
  params: PaginationParams
): Promise<CommissionsListResponse> {
  const page = params.page || 1;
  const limit = params.limit || 10;
  const skip = (page - 1) * limit;

  const where: any = { userId, tenantId };

  if (params.status) {
    where.status = params.status;
  }

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      where.createdAt.gte = new Date(params.startDate);
    }
    if (params.endDate) {
      where.createdAt.lte = new Date(params.endDate);
    }
  }

  const [commissions, total] = await Promise.all([
    prisma.commission.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            totalAmount: true,
            status: true
          }
        }
      }
    }),
    prisma.commission.count({ where })
  ]);

  return {
    commissions: commissions as any,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * 用户申请提现
 */
async function requestPayout(
  userId: string,
  tenantId: number,
  data: RequestPayoutRequest
): Promise<PayoutResponse> {
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pendingBalance: true }
  });

  if (!user) {
    throw new Error('User not found');
  }

  const config = await prisma.tenantCommissionConfig.findUnique({
    where: { tenantId }
  });

  if (!config) {
    throw new Error('Commission config not found');
  }

  const settledCommissions = await prisma.commission.findMany({
    where: {
      userId,
      tenantId,
      status: CommissionStatus.PENDING,
      settleAt: { lte: now }
    }
  });

  const availableAmount = settledCommissions.reduce((sum, c) => sum + c.amount, 0);

  if (data.amount < config.minPayoutAmount) {
    throw new Error(`Minimum payout amount is ${config.minPayoutAmount}`);
  }

  if (data.amount > availableAmount) {
    throw new Error(`Insufficient balance. Available: ${availableAmount}`);
  }

  const payout = await prisma.payout.create({
    data: {
      tenantId,
      userId,
      amount: data.amount,
      method: data.method,
      accountInfo: JSON.stringify(data.accountInfo),
      status: PayoutStatus.PENDING
    }
  });

  return payout as any;
}

/**
 * 获取用户的提现记录列表
 */
async function getUserPayouts(
  userId: string,
  tenantId: number,
  params: PaginationParams
): Promise<PayoutsListResponse> {
  const page = params.page || 1;
  const limit = params.limit || 10;
  const skip = (page - 1) * limit;

  const where: any = { userId, tenantId };

  if (params.status) {
    where.status = params.status;
  }

  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.payout.count({ where })
  ]);

  return {
    payouts: payouts as any,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * 获取租户的分润配置
 */
async function getConfig(tenantId: number): Promise<CommissionConfigResponse | null> {
  const config = await prisma.tenantCommissionConfig.findUnique({
    where: { tenantId }
  });

  return config as any;
}

/**
 * 更新租户的分润配置
 */
async function updateConfig(
  tenantId: number,
  data: UpdateCommissionConfigRequest
): Promise<CommissionConfigResponse> {
  const config = await prisma.tenantCommissionConfig.upsert({
    where: { tenantId },
    create: {
      tenantId,
      ...data
    },
    update: data
  });

  return config as any;
}

/**
 * 更新用户的个性化分润比例
 */
async function updateUserCommissionRate(
  userId: string,
  tenantId: number,
  data: UpdateUserCommissionRateRequest
): Promise<void> {
  await prisma.user.update({
    where: {
      id: userId,
      tenantId
    },
    data: {
      customCommissionRate: data.rate
    }
  });
}

/**
 * 管理员获取所有佣金记录
 */
async function getAllCommissions(
  tenantId: number,
  params: PaginationParams
): Promise<CommissionsListResponse> {
  const page = params.page || 1;
  const limit = params.limit || 10;
  const skip = (page - 1) * limit;

  const where: any = { tenantId };

  if (params.status) {
    where.status = params.status;
  }

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      where.createdAt.gte = new Date(params.startDate);
    }
    if (params.endDate) {
      where.createdAt.lte = new Date(params.endDate);
    }
  }

  const [commissions, total] = await Promise.all([
    prisma.commission.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        },
        order: {
          select: {
            id: true,
            totalAmount: true,
            status: true
          }
        }
      }
    }),
    prisma.commission.count({ where })
  ]);

  return {
    commissions: commissions as any,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * 管理员获取所有提现申请
 */
async function getAllPayouts(
  tenantId: number,
  params: PaginationParams
): Promise<PayoutsListResponse> {
  const page = params.page || 1;
  const limit = params.limit || 10;
  const skip = (page - 1) * limit;

  const where: any = { tenantId };

  if (params.status) {
    where.status = params.status;
  }

  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    }),
    prisma.payout.count({ where })
  ]);

  return {
    payouts: payouts as any,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * 管理员处理提现申请
 */
async function processPayout(
  payoutId: string,
  tenantId: number,
  processedBy: string,
  data: ProcessPayoutRequest
): Promise<PayoutResponse> {
  const payout = await prisma.payout.findFirst({
    where: { id: payoutId, tenantId }
  });

  if (!payout) {
    throw new Error('Payout not found');
  }

  if (payout.status !== PayoutStatus.PENDING) {
    throw new Error('Payout already processed');
  }

  const now = new Date();

  const updatedPayout = await prisma.$transaction(async (tx) => {
    const updated = await tx.payout.update({
      where: { id: payoutId },
      data: {
        status: data.status,
        processedAt: now,
        processedBy,
        failureReason: data.failureReason,
        note: data.note
      }
    });

    if (data.status === PayoutStatus.COMPLETED) {
      const settledCommissions = await tx.commission.findMany({
        where: {
          userId: payout.userId,
          tenantId,
          status: CommissionStatus.PENDING,
          settleAt: { lte: now }
        }
      });

      if (settledCommissions.length > 0) {
        await tx.commission.updateMany({
          where: {
            id: { in: settledCommissions.map(c => c.id) }
          },
          data: {
            status: CommissionStatus.PAID,
            settledAt: now,
            paidAt: now
          }
        });
      }

      const totalCommissionAmount = settledCommissions.reduce((sum, c) => sum + c.amount, 0);

      await tx.user.update({
        where: { id: payout.userId },
        data: {
          pendingBalance: { decrement: totalCommissionAmount }
        }
      });
    }

    if (data.status === PayoutStatus.FAILED || data.status === PayoutStatus.CANCELLED) {
      await tx.user.update({
        where: { id: payout.userId },
        data: {
          availableBalance: { increment: payout.amount }
        }
      });
    }

    return updated;
  });

  return updatedPayout as any;
}

/**
 * 获取所有分销商用户
 */
async function getAffiliateUsers(
  tenantId: number,
  params: { page: number; limit: number; search?: string }
): Promise<{
  users: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const { page, limit, search } = params;
  const skip = (page - 1) * limit;

  const where: any = {
    tenantId,
    referralCode: { not: null },
  };

  if (search) {
    where.OR = [
      { username: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { referralCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        username: true,
        email: true,
        referralCode: true,
        customCommissionRate: true,
        totalEarnings: true,
        availableBalance: true,
        pendingBalance: true,
        totalReferrals: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 注意：许可证检查已移至 commercial-support.ts 中的 checkAffiliateLicense 装饰器
 * 不再在此处进行重复的许可证检查
 */

// ============================================
// 许可证管理API（仅限 Super Admin）
// ============================================

/**
 * 获取许可证详情（Super Admin 专用）
 */
async function getLicenseDetails(tenantId: number): Promise<any> {
  const license = await prisma.pluginLicense.findUnique({
    where: {
      tenantId_pluginId: {
        tenantId,
        pluginId: 'affiliate'
      }
    },
    include: {
      tenant: {
        select: {
          id: true,
          companyName: true
        }
      },
      plugin: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });

  if (!license) {
    return {
      hasLicense: false,
      status: 'NOT_PURCHASED',
      message: 'Affiliate plugin license not purchased'
    };
  }

  return {
    hasLicense: true,
    status: license.status,
    purchaseDate: license.purchaseDate,
    activatedAt: license.activatedAt,
    deactivatedAt: license.deactivatedAt,
    amount: license.amount,
    currency: license.currency,
    tenantName: license.tenant.companyName,
    pluginName: license.plugin.name
  };
}

// ============================================
// 插件定义
// ============================================

const affiliatePlugin: FastifyPluginAsync = async (fastify) => {
  // ============================================
  // 装饰器：暴露 calculateAffiliateCommission 方法
  // 供其他插件（如 stripe）调用
  // ============================================
  fastify.decorate('calculateAffiliateCommission', async function (orderId: string, tenantId: number) {
    return await calculateCommission(orderId, tenantId);
  });

  // 创建许可证检查中间件
  const checkAffiliateLicense = createAffiliateLicenseCheckMiddleware(fastify);

  // ============================================
  // 用户端API (5个)
  // ============================================

  // GET /referral-code - 获取邀请码
  fastify.get('/referral-code', {
    schema: {
      tags: ['plugins', 'affiliate'],
      summary: 'Get Referral Code',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                referralCode: { type: 'string' }
              }
            }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware, checkAffiliateLicense]
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.userId;
      const code = await ensureReferralCode(userId);

      return reply.send({
        success: true,
        data: { referralCode: code }
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // GET /stats - 获取分销统计
  fastify.get('/stats', {
    schema: {
      tags: ['plugins', 'affiliate'],
      summary: 'Get Affiliate Stats',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware, checkAffiliateLicense]
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.userId;
      const tenantId = (request as any).user.tenantId;
      const stats = await getUserStats(userId, tenantId);

      return reply.send({
        success: true,
        data: stats
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // GET /commissions - 获取佣金记录
  fastify.get('/commissions', {
    schema: {
      tags: ['plugins', 'affiliate'],
      summary: 'Get Commissions',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                commissions: { type: 'array', items: { type: 'object', additionalProperties: true } },
                pagination: { type: 'object', additionalProperties: true }
              }
            }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware, checkAffiliateLicense]
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.userId;
      const tenantId = (request as any).user.tenantId;
      const query = request.query as any;
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 20;

      const result = await getUserCommissions(userId, tenantId, { page, limit });

      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // POST /payouts - 申请提现
  fastify.post('/payouts', {
    schema: {
      tags: ['plugins', 'affiliate'],
      summary: 'Request Payout',
      body: {
        type: 'object',
        required: ['amount', 'method', 'account'],
        properties: {
          amount: { type: 'number' },
          method: { type: 'string' },
          account: { type: 'string' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true }
          }
        },
        '4xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware, checkAffiliateLicense]
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.userId;
      const tenantId = (request as any).user.tenantId;
      const body = request.body as any;

      const schema = RequestPayoutSchema.parse(body);
      const payout = await requestPayout(userId, tenantId, schema);

      return reply.status(201).send({
        success: true,
        data: payout
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // GET /payouts - 获取提现记录
  fastify.get('/payouts', {
    schema: {
      tags: ['plugins', 'affiliate'],
      summary: 'Get Payouts',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                payouts: { type: 'array', items: { type: 'object', additionalProperties: true } },
                pagination: { type: 'object', additionalProperties: true }
              }
            }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware, checkAffiliateLicense]
  }, async (request, reply) => {
    try {
      const userId = (request as any).user.userId;
      const tenantId = (request as any).user.tenantId;
      const query = request.query as any;
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 20;

      const result = await getUserPayouts(userId, tenantId, { page, limit });

      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // ============================================
  // 管理端API (7个)
  // ============================================

  // GET /admin/config - 获取分润配置
  fastify.get('/admin/config', {
    schema: {
      tags: ['plugins', 'affiliate'],
      summary: 'Get Affiliate Config',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware, requireTenantAdminMiddleware]
  }, async (request, reply) => {
    try {
      const tenantId = (request as any).user.tenantId;
      const config = await getConfig(tenantId);

      return reply.send({
        success: true,
        data: config
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // PUT /admin/config - 更新分润配置
  fastify.put('/admin/config', {
    schema: {
      tags: ['plugins', 'affiliate'],
      summary: 'Update Affiliate Config',
      body: {
        type: 'object',
        properties: {
          commissionRate: { type: 'number' },
          cookieDuration: { type: 'number' },
          minimumPayoutAmount: { type: 'number' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true }
          }
        },
        '4xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware, requireTenantAdminMiddleware]
  }, async (request, reply) => {
    try {
      const tenantId = (request as any).user.tenantId;
      const body = request.body as any;

      const schema = UpdateCommissionConfigSchema.parse(body);
      const config = await updateConfig(tenantId, schema);

      return reply.send({
        success: true,
        data: config
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // GET /admin/affiliates - 获取分销商列表
  fastify.get('/admin/affiliates', {
    schema: {
      tags: ['plugins', 'affiliate'],
      summary: 'Get Affiliates List',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' },
          search: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                users: { type: 'array', items: { type: 'object', additionalProperties: true } },
                pagination: { type: 'object', additionalProperties: true }
              }
            }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware, requireTenantAdminMiddleware]
  }, async (request, reply) => {
    try {
      const tenantId = (request as any).user.tenantId;
      const query = request.query as any;
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 20;
      const search = query.search || '';

      const result = await getAffiliateUsers(tenantId, { page, limit, search });

      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // PUT /admin/affiliates/:userId/rate - 设置用户分润比例
  fastify.put('/admin/affiliates/:userId/rate', {
    schema: {
      tags: ['plugins', 'affiliate'],
      summary: 'Update User Commission Rate',
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['rate'],
        properties: {
          rate: { type: 'number' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' }
              }
            }
          }
        },
        '4xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware, requireTenantAdminMiddleware]
  }, async (request, reply) => {
    try {
      const tenantId = (request as any).user.tenantId;
      const { userId } = request.params as any;
      const body = request.body as any;

      const schema = UpdateUserCommissionRateSchema.parse(body);
      await updateUserCommissionRate(userId, tenantId, schema);

      return reply.send({
        success: true,
        data: {
          message: 'Commission rate updated successfully'
        }
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // GET /admin/commissions - 获取所有佣金记录
  fastify.get('/admin/commissions', {
    schema: {
      tags: ['plugins', 'affiliate'],
      summary: 'Get All Commissions',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' },
          status: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                commissions: { type: 'array', items: { type: 'object', additionalProperties: true } },
                pagination: { type: 'object', additionalProperties: true }
              }
            }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware, requireTenantAdminMiddleware]
  }, async (request, reply) => {
    try {
      const tenantId = (request as any).user.tenantId;

      const query = request.query as any;
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 20;
      const status = query.status;

      const result = await getAllCommissions(tenantId, { page, limit, status });

      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // GET /admin/payouts - 获取所有提现申请
  fastify.get('/admin/payouts', {
    schema: {
      tags: ['plugins', 'affiliate'],
      summary: 'Get All Payouts',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' },
          status: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                payouts: { type: 'array', items: { type: 'object', additionalProperties: true } },
                pagination: { type: 'object', additionalProperties: true }
              }
            }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware, requireTenantAdminMiddleware]
  }, async (request, reply) => {
    try {
      const tenantId = (request as any).user.tenantId;
      const query = request.query as any;
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 20;
      const status = query.status;

      const result = await getAllPayouts(tenantId, { page, limit, status });

      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // PUT /admin/payouts/:payoutId - 处理提现申请
  fastify.put('/admin/payouts/:payoutId', {
    schema: {
      tags: ['plugins', 'affiliate'],
      summary: 'Process Payout',
      params: {
        type: 'object',
        required: ['payoutId'],
        properties: {
          payoutId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string' },
          failureReason: { type: 'string' },
          note: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true }
          }
        },
        '4xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware, requireTenantAdminMiddleware]
  }, async (request, reply) => {
    try {
      const tenantId = (request as any).user.tenantId;
      const userId = (request as any).user.userId;
      const { payoutId } = request.params as any;
      const body = request.body as any;

      const schema = ProcessPayoutSchema.parse(body);
      const result = await processPayout(payoutId, tenantId, userId, schema);

      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // ============================================
  // 许可证API (2个)
  // ============================================

  // GET /license/status - 检查许可证状态
  fastify.get('/license/status', {
    schema: {
      tags: ['plugins', 'affiliate'],
      summary: 'Get License Status',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware, checkAffiliateLicense]
  }, async (request, reply) => {
    try {
      const tenantId = (request as any).user.tenantId;

      const licenseDetails = await getLicenseDetails(tenantId);

      return reply.send({
        success: true,
        data: licenseDetails
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // POST /license/activate - 激活许可证（仅限 Tenant Admin）
  fastify.post('/license/activate', {
    schema: {
      tags: ['plugins', 'affiliate'],
      summary: 'Activate License',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
            message: { type: 'string' }
          }
        },
        '4xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware, requireTenantAdminMiddleware]
  }, async (request, reply) => {
    try {
      const tenantId = (request as any).user.tenantId;

      const licenseDetails = await getLicenseDetails(tenantId);

      return reply.send({
        success: true,
        data: licenseDetails,
        message: 'License is active'
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // ============================================
  // Super Admin 路由 (9个)
  // ============================================

  // GET /super-admin/stats - 统计仪表板
  fastify.get('/super-admin/stats', {
    schema: {
      hide: true,
      tags: ['plugins', 'affiliate'],
      summary: 'Get Super Admin Stats',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const role = (request as any).user.role;

      if (role !== 'SUPER_ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden'
        });
      }

      const [totalLicenses, activeLicenses, totalRevenue, totalTenants] = await Promise.all([
        prisma.pluginLicense.count(),
        prisma.pluginLicense.count({ where: { status: 'ACTIVE' } }),
        prisma.pluginLicense.aggregate({
          _sum: { amount: true }
        }),
        prisma.tenant.count()
      ]);

      return reply.send({
        success: true,
        data: {
          totalLicenses,
          activeLicenses,
          totalRevenue: totalRevenue._sum.amount || 0,
          activationRate: totalLicenses > 0 ? (activeLicenses / totalLicenses * 100).toFixed(2) : 0,
          totalTenants
        }
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // GET /super-admin/licenses - 许可证列表
  fastify.get('/super-admin/licenses', {
    schema: {
      hide: true,
      tags: ['plugins', 'affiliate'],
      summary: 'Get All Licenses',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' },
          status: { type: 'string' },
          tenantId: { type: 'number' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                licenses: { type: 'array', items: { type: 'object', additionalProperties: true } },
                pagination: { type: 'object', additionalProperties: true }
              }
            }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const role = (request as any).user.role;
      const { page = 1, limit = 10, status, tenantId } = request.query as any;

      if (role !== 'SUPER_ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden'
        });
      }

      const where: any = {};
      if (status) where.status = status;
      if (tenantId) where.tenantId = parseInt(tenantId);

      const [licenses, total] = await Promise.all([
        prisma.pluginLicense.findMany({
          where,
          include: { tenant: true, plugin: true },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.pluginLicense.count({ where })
      ]);

      return reply.send({
        success: true,
        data: {
          licenses,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // GET /super-admin/licenses/:tenantId - 租户许可证详情
  fastify.get('/super-admin/licenses/:tenantId', {
    schema: {
      hide: true,
      tags: ['plugins', 'affiliate'],
      summary: 'Get Tenant License Details',
      params: {
        type: 'object',
        required: ['tenantId'],
        properties: {
          tenantId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const role = (request as any).user.role;
      const { tenantId } = request.params as any;

      if (role !== 'SUPER_ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden'
        });
      }

      const license = await prisma.pluginLicense.findUnique({
        where: {
          tenantId_pluginId: {
            tenantId: parseInt(tenantId),
            pluginId: 'affiliate'
          }
        },
        include: { tenant: true, plugin: true }
      });

      if (!license) {
        return reply.status(404).send({
          success: false,
          error: 'License not found'
        });
      }

      return reply.send({
        success: true,
        data: license
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // POST /super-admin/licenses/:tenantId/activate - 激活许可证
  fastify.post('/super-admin/licenses/:tenantId/activate', {
    schema: {
      hide: true,
      tags: ['plugins', 'affiliate'],
      summary: 'Activate Tenant License',
      params: {
        type: 'object',
        required: ['tenantId'],
        properties: {
          tenantId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true }
          }
        },
        '4xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const role = (request as any).user.role;
      const { tenantId } = request.params as any;

      if (role !== 'SUPER_ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden'
        });
      }

      const license = await prisma.pluginLicense.update({
        where: {
          tenantId_pluginId: {
            tenantId: parseInt(tenantId),
            pluginId: 'affiliate'
          }
        },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date()
        }
      });

      // 审计日志
      await prisma.auditLog.create({
        data: {
          tenantId: parseInt(tenantId),
          userId: (request as any).user.id,
          action: 'ACTIVATE_LICENSE',
          module: 'plugins',
          resourceId: license.id.toString(),
          newValues: JSON.stringify({ status: 'ACTIVE' })
        }
      });

      return reply.send({
        success: true,
        data: license
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // POST /super-admin/licenses/:tenantId/deactivate - 停用许可证
  fastify.post('/super-admin/licenses/:tenantId/deactivate', {
    schema: {
      hide: true,
      tags: ['plugins', 'affiliate'],
      summary: 'Deactivate Tenant License',
      params: {
        type: 'object',
        required: ['tenantId'],
        properties: {
          tenantId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true }
          }
        },
        '4xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const role = (request as any).user.role;
      const { tenantId } = request.params as any;

      if (role !== 'SUPER_ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden'
        });
      }

      const license = await prisma.pluginLicense.update({
        where: {
          tenantId_pluginId: {
            tenantId: parseInt(tenantId),
            pluginId: 'affiliate'
          }
        },
        data: {
          status: 'INACTIVE',
          deactivatedAt: new Date()
        }
      });

      // 审计日志
      await prisma.auditLog.create({
        data: {
          tenantId: parseInt(tenantId),
          userId: (request as any).user.id,
          action: 'DEACTIVATE_LICENSE',
          module: 'plugins',
          resourceId: license.id.toString(),
          newValues: JSON.stringify({ status: 'INACTIVE' })
        }
      });

      return reply.send({
        success: true,
        data: license
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // GET /super-admin/tenants - 租户列表
  fastify.get('/super-admin/tenants', {
    schema: {
      hide: true,
      tags: ['plugins', 'affiliate'],
      summary: 'Get All Tenants',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                tenants: { type: 'array', items: { type: 'object', additionalProperties: true } },
                pagination: { type: 'object', additionalProperties: true }
              }
            }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const role = (request as any).user.role;
      const { page = 1, limit = 10 } = request.query as any;

      if (role !== 'SUPER_ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden'
        });
      }

      const [tenants, total] = await Promise.all([
        prisma.tenant.findMany({
          include: {
            pluginLicenses: {
              where: { pluginId: 'affiliate' }
            }
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.tenant.count()
      ]);

      return reply.send({
        success: true,
        data: {
          tenants,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // GET /super-admin/tenants/:tenantId - 租户详情
  fastify.get('/super-admin/tenants/:tenantId', {
    schema: {
      hide: true,
      tags: ['plugins', 'affiliate'],
      summary: 'Get Tenant Details',
      params: {
        type: 'object',
        required: ['tenantId'],
        properties: {
          tenantId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const role = (request as any).user.role;
      const { tenantId } = request.params as any;

      if (role !== 'SUPER_ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden'
        });
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: parseInt(tenantId) },
        include: {
          pluginLicenses: {
            where: { pluginId: 'affiliate' }
          }
        }
      });

      if (!tenant) {
        return reply.status(404).send({
          success: false,
          error: 'Tenant not found'
        });
      }

      return reply.send({
        success: true,
        data: tenant
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // GET /super-admin/commissions - 佣金记录
  fastify.get('/super-admin/commissions', {
    schema: {
      hide: true,
      tags: ['plugins', 'affiliate'],
      summary: 'Get Super Admin Commissions',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' },
          tenantId: { type: 'number' },
          status: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                commissions: { type: 'array', items: { type: 'object', additionalProperties: true } },
                pagination: { type: 'object', additionalProperties: true }
              }
            }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const role = (request as any).user.role;
      const { page = 1, limit = 10, tenantId, status, startDate, endDate } = request.query as any;

      if (role !== 'SUPER_ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden'
        });
      }

      const where: any = {};
      if (tenantId) where.tenantId = parseInt(tenantId);
      if (status) where.status = status;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [commissions, total] = await Promise.all([
        prisma.commission.findMany({
          where,
          include: { user: true, order: true },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.commission.count({ where })
      ]);

      return reply.send({
        success: true,
        data: {
          commissions,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // GET /super-admin/payouts - 提现管理
  fastify.get('/super-admin/payouts', {
    schema: {
      hide: true,
      tags: ['plugins', 'affiliate'],
      summary: 'Get Super Admin Payouts',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          limit: { type: 'number' },
          tenantId: { type: 'number' },
          status: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                payouts: { type: 'array', items: { type: 'object', additionalProperties: true } },
                pagination: { type: 'object', additionalProperties: true }
              }
            }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    onRequest: [authMiddleware]
  }, async (request, reply) => {
    try {
      const role = (request as any).user.role;
      const { page = 1, limit = 10, tenantId, status } = request.query as any;

      if (role !== 'SUPER_ADMIN') {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden'
        });
      }

      const where: any = {};
      if (tenantId) where.tenantId = parseInt(tenantId);
      if (status) where.status = status;

      const [payouts, total] = await Promise.all([
        prisma.payout.findMany({
          where,
          include: { user: true },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.payout.count({ where })
      ]);

      return reply.send({
        success: true,
        data: {
          payouts,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error: any) {
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });
};

export default affiliatePlugin;


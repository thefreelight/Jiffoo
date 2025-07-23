import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { LoggerService } from '@/core/logger/logger';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export interface DashboardStats {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  todayOrders: number;
  todayRevenue: number;
  userGrowth: number;
  orderGrowth: number;
  revenueGrowth: number;
}

export interface SalesStats {
  period: string;
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  topProducts: Array<{
    id: string;
    name: string;
    totalSold: number;
    revenue: number;
  }>;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  usersByRole: Record<string, number>;
  userGrowthTrend: Array<{
    date: string;
    count: number;
  }>;
}

export interface ProductStats {
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  topSellingProducts: Array<{
    id: string;
    name: string;
    totalSold: number;
    revenue: number;
    stock: number;
  }>;
  categoryStats: Array<{
    category: string;
    count: number;
    revenue: number;
  }>;
}

export class StatisticsService {
  private static readonly CACHE_TTL = 1800; // 30 minutes

  /**
   * 获取仪表板统计数据
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    const cacheKey = 'dashboard_stats';

    // 尝试从缓存获取
    const cached = await CacheService.getStats(cacheKey);
    if (cached) {
      LoggerService.logCache('GET', cacheKey, true);
      return cached;
    }

    LoggerService.logPerformance('dashboard_stats_calculation', 0);
    const startTime = Date.now();

    const today = new Date();
    const yesterday = subDays(today, 1);
    const lastMonth = subDays(today, 30);

    const [
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      todayOrders,
      todayRevenue,
      yesterdayOrders,
      yesterdayRevenue,
      lastMonthUsers
    ] = await Promise.all([
      // 总用户数
      prisma.user.count(),

      // 总商品数
      prisma.product.count(),

      // 总订单数
      prisma.order.count(),

      // 总收入
      prisma.order.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { totalAmount: true }
      }),

      // 今日订单数
      prisma.order.count({
        where: {
          createdAt: {
            gte: startOfDay(today),
            lte: endOfDay(today)
          }
        }
      }),

      // 今日收入
      prisma.order.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: startOfDay(today),
            lte: endOfDay(today)
          }
        },
        _sum: { totalAmount: true }
      }),

      // 昨日订单数
      prisma.order.count({
        where: {
          createdAt: {
            gte: startOfDay(yesterday),
            lte: endOfDay(yesterday)
          }
        }
      }),

      // 昨日收入
      prisma.order.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: startOfDay(yesterday),
            lte: endOfDay(yesterday)
          }
        },
        _sum: { totalAmount: true }
      }),

      // 上月用户数
      prisma.user.count({
        where: {
          createdAt: { lte: lastMonth }
        }
      })
    ]);

    // 计算增长率
    const userGrowth = lastMonthUsers > 0 ?
      ((totalUsers - lastMonthUsers) / lastMonthUsers) * 100 : 0;

    const orderGrowth = yesterdayOrders > 0 ?
      ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100 : 0;

    const revenueGrowth = (yesterdayRevenue._sum.totalAmount || 0) > 0 ?
      (((todayRevenue._sum.totalAmount || 0) - (yesterdayRevenue._sum.totalAmount || 0)) /
       (yesterdayRevenue._sum.totalAmount || 1)) * 100 : 0;

    const stats: DashboardStats = {
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
      todayOrders,
      todayRevenue: todayRevenue._sum.totalAmount || 0,
      userGrowth: Math.round(userGrowth * 100) / 100,
      orderGrowth: Math.round(orderGrowth * 100) / 100,
      revenueGrowth: Math.round(revenueGrowth * 100) / 100
    };

    // 缓存结果
    await CacheService.setStats(cacheKey, stats, this.CACHE_TTL);
    LoggerService.logCache('SET', cacheKey, false);

    const duration = Date.now() - startTime;
    LoggerService.logPerformance('dashboard_stats_calculation', duration);

    return stats;
  }

  /**
   * 获取销售统计
   */
  static async getSalesStats(days: number = 30): Promise<SalesStats> {
    const cacheKey = `sales_stats_${days}`;

    const cached = await CacheService.getStats(cacheKey);
    if (cached) {
      return cached;
    }

    const startDate = subDays(new Date(), days);

    const [orders, topProducts] = await Promise.all([
      // 订单统计
      prisma.order.findMany({
        where: {
          createdAt: { gte: startDate },
          status: 'COMPLETED'
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      }),

      // 热销商品
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            createdAt: { gte: startDate },
            status: 'COMPLETED'
          }
        },
        _sum: {
          quantity: true,
          unitPrice: true
        },
        orderBy: {
          _sum: {
            quantity: 'desc'
          }
        },
        take: 10
      })
    ]);

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // 获取商品详情
    const productIds = topProducts.map((item: any) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true }
    });

    const topProductsWithDetails = topProducts.map((item: any) => {
      const product = products.find((p: any) => p.id === item.productId);
      return {
        id: item.productId,
        name: product?.name || 'Unknown Product',
        totalSold: item._sum.quantity || 0,
        revenue: item._sum.unitPrice || 0
      };
    });

    const stats: SalesStats = {
      period: `${days} days`,
      totalOrders,
      totalRevenue,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      topProducts: topProductsWithDetails
    };

    await CacheService.setStats(cacheKey, stats, this.CACHE_TTL);
    return stats;
  }

  /**
   * 获取用户统计
   */
  static async getUserStats(): Promise<UserStats> {
    const cacheKey = 'user_stats';

    const cached = await CacheService.getStats(cacheKey);
    if (cached) {
      return cached;
    }

    const thirtyDaysAgo = subDays(new Date(), 30);
    const sevenDaysAgo = subDays(new Date(), 7);

    const [
      totalUsers,
      newUsers,
      usersByRole,
      userGrowthData
    ] = await Promise.all([
      // 总用户数
      prisma.user.count(),

      // 新用户数 (7天内)
      prisma.user.count({
        where: {
          createdAt: { gte: sevenDaysAgo }
        }
      }),

      // 按角色分组
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true }
      }),

      // 用户增长趋势 (30天)
      prisma.user.findMany({
        where: {
          createdAt: { gte: thirtyDaysAgo }
        },
        select: {
          createdAt: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      })
    ]);

    // 处理角色统计
    const roleStats: Record<string, number> = {};
    usersByRole.forEach((item: any) => {
      roleStats[item.role] = item._count.role;
    });

    // 处理增长趋势
    const growthTrend: Array<{ date: string; count: number }> = [];
    const dailyCounts: Record<string, number> = {};

    userGrowthData.forEach((user: any) => {
      const date = format(user.createdAt, 'yyyy-MM-dd');
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    for (let i = 29; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      growthTrend.push({
        date,
        count: dailyCounts[date] || 0
      });
    }

    const stats: UserStats = {
      totalUsers,
      activeUsers: totalUsers, // 简化处理，实际应该基于最近活动
      newUsers,
      usersByRole: roleStats,
      userGrowthTrend: growthTrend
    };

    await CacheService.setStats(cacheKey, stats, this.CACHE_TTL);
    return stats;
  }

  /**
   * 获取商品统计
   */
  static async getProductStats(): Promise<ProductStats> {
    const cacheKey = 'product_stats';

    const cached = await CacheService.getStats(cacheKey);
    if (cached) {
      return cached;
    }

    const [
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      topSellingData
    ] = await Promise.all([
      // 总商品数
      prisma.product.count(),

      // 低库存商品 (库存 < 10)
      prisma.product.count({
        where: {
          stock: { lt: 10, gt: 0 }
        }
      }),

      // 缺货商品
      prisma.product.count({
        where: {
          stock: { lte: 0 }
        }
      }),

      // 热销商品数据
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            status: 'COMPLETED'
          }
        },
        _sum: {
          quantity: true,
          unitPrice: true
        },
        orderBy: {
          _sum: {
            quantity: 'desc'
          }
        },
        take: 10
      })
    ]);

    // 获取热销商品详情
    const productIds = topSellingData.map((item: any) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, stock: true }
    });

    const topSellingProducts = topSellingData.map((item: any) => {
      const product = products.find((p: any) => p.id === item.productId);
      return {
        id: item.productId,
        name: product?.name || 'Unknown Product',
        totalSold: item._sum.quantity || 0,
        revenue: item._sum.price || 0,
        stock: product?.stock || 0
      };
    });

    const stats: ProductStats = {
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      topSellingProducts,
      categoryStats: [] // 简化处理，实际需要分类字段
    };

    await CacheService.setStats(cacheKey, stats, this.CACHE_TTL);
    return stats;
  }

  /**
   * 清除统计缓存
   */
  static async clearStatsCache(): Promise<void> {
    await CacheService.deletePattern('stats:*');
    LoggerService.logSystem('Statistics cache cleared');
  }

  /**
   * 获取实时统计
   */
  static async getRealTimeStats(): Promise<{
    onlineUsers: number;
    todayVisitors: number;
    activeOrders: number;
    systemLoad: number;
  }> {
    // 这里可以集成实时数据源
    // 暂时返回模拟数据
    return {
      onlineUsers: Math.floor(Math.random() * 100) + 10,
      todayVisitors: Math.floor(Math.random() * 1000) + 100,
      activeOrders: await prisma.order.count({
        where: {
          status: { in: ['PENDING', 'PROCESSING'] }
        }
      }),
      systemLoad: Math.random() * 100
    };
  }
}

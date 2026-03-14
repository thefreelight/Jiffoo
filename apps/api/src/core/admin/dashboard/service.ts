/**
 * Admin Dashboard Service
 * Handles aggregated data for admin dashboard
 */

import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { getTodayAndYesterdayRangeUtc } from '@/utils/timezone';

function calculateTrendPercent(current: number, previous: number): number {
    if (previous === 0) {
        return current === 0 ? 0 : 100;
    }

    const trend = ((current - previous) / previous) * 100;
    return Number(trend.toFixed(2));
}

export class AdminDashboardService {
    private static async getDashboardMetricSummary() {
        const cacheKey = 'stats:admin-dashboard:metrics';
        const cached = await CacheService.get<any>(cacheKey);
        if (cached) return cached;

        const [currency, timezone] = await Promise.all([
            systemSettingsService.getShopCurrency(),
            systemSettingsService.getTimezone(),
        ]);
        const { startOfTodayUtc, startOfYesterdayUtc } = getTodayAndYesterdayRangeUtc(timezone);

        const [
            revenueResult,
            totalOrders,
            totalProducts,
            totalUsers,
            todayRevenueResult,
            yesterdayRevenueResult,
            todayOrders,
            yesterdayOrders,
            todayProducts,
            yesterdayProducts,
            todayUsers,
            yesterdayUsers
        ] = await Promise.all([
            prisma.order.aggregate({
                _sum: { totalAmount: true },
                where: {
                    paymentStatus: 'PAID',
                    status: { notIn: ['CANCELLED', 'REFUNDED'] }
                }
            }),
            prisma.order.count(),
            prisma.product.count(),
            prisma.user.count(),
            prisma.order.aggregate({
                _sum: { totalAmount: true },
                where: {
                    paymentStatus: 'PAID',
                    status: { notIn: ['CANCELLED', 'REFUNDED'] },
                    createdAt: { gte: startOfTodayUtc }
                }
            }),
            prisma.order.aggregate({
                _sum: { totalAmount: true },
                where: {
                    paymentStatus: 'PAID',
                    status: { notIn: ['CANCELLED', 'REFUNDED'] },
                    createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc }
                }
            }),
            prisma.order.count({
                where: { createdAt: { gte: startOfTodayUtc } }
            }),
            prisma.order.count({
                where: { createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc } }
            }),
            prisma.product.count({
                where: { createdAt: { gte: startOfTodayUtc } }
            }),
            prisma.product.count({
                where: { createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc } }
            }),
            prisma.user.count({
                where: { createdAt: { gte: startOfTodayUtc } }
            }),
            prisma.user.count({
                where: { createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc } }
            })
        ]);

        const totalRevenue = Number(revenueResult._sum.totalAmount || 0);
        const todayRevenue = Number(todayRevenueResult._sum.totalAmount || 0);
        const yesterdayRevenue = Number(yesterdayRevenueResult._sum.totalAmount || 0);

        const result = {
            metrics: {
                totalRevenue,
                totalOrders,
                totalProducts,
                totalUsers,
                currency,
                totalRevenueTrend: calculateTrendPercent(todayRevenue, yesterdayRevenue),
                totalOrdersTrend: calculateTrendPercent(todayOrders, yesterdayOrders),
                totalProductsTrend: calculateTrendPercent(todayProducts, yesterdayProducts),
                totalUsersTrend: calculateTrendPercent(todayUsers, yesterdayUsers)
            }
        };

        await CacheService.set(cacheKey, result, { ttl: 15 });
        return result;
    }

    static async getDashboardMetrics(include: string[] = []) {
        // 0. Check Cache (15s TTL)
        const cacheKey = `stats:admin-dashboard:${include.sort().join(',')}`;
        const cached = await CacheService.get<any>(cacheKey);
        if (cached) return cached;

        const { metrics } = await this.getDashboardMetricSummary();
        const currency = metrics.currency;

        const promises: any[] = [
            prisma.order.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    status: true,
                    paymentStatus: true,
                    totalAmount: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true, // Unified: include id
                            email: true,
                            username: true
                        }
                    }
                }
            })
        ];

        // Keep response structure stable: ordersByStatus is required by API schema.
        const ordersByStatusPromise = (prisma.order as any).groupBy({
            by: ['status'],
            _count: { status: true }
        });

        // 2. Execute Queries
        const [recentOrders] = await Promise.all(promises);

        const ordersByStatusRaw = await ordersByStatusPromise;
        const ordersByStatus: Record<string, number> = {
            PENDING: 0, PAID: 0, PROCESSING: 0, COMPLETED: 0,
            SHIPPED: 0, DELIVERED: 0, CANCELLED: 0, REFUNDED: 0
        };
        ordersByStatusRaw.forEach((item: any) => {
            const statusKey = item.status;
            ordersByStatus[statusKey] = item._count.status;
        });

        const result = {
            metrics,
            ordersByStatus,
            recentOrders: recentOrders.map((order: any) => ({
                id: order.id,
                status: order.status,
                paymentStatus: order.paymentStatus,
                totalAmount: Number(order.totalAmount),
                currency,
                createdAt: order.createdAt.toISOString(), // Unified: ISO string
                customer: {
                    id: order.user?.id || null,
                    email: order.user?.email || null,
                    username: order.user?.username || null
                }
            }))
        };

        // Cache for 15s
        await CacheService.set(cacheKey, result, { ttl: 15 });

        return result;
    }

    static async getMultiStoreStats() {
        // 0. Check Cache (15s TTL)
        const cacheKey = 'stats:multi-store:all';
        const cached = await CacheService.get<any>(cacheKey);
        if (cached) return cached;

        // 1. Get all stores
        const stores = await prisma.store.findMany({
            select: {
                id: true,
                name: true,
                slug: true,
                currency: true,
                status: true
            },
            orderBy: { createdAt: 'asc' }
        });

        // 2. Prepare promises for each store
        const storeStatsPromises = stores.map(async (store) => {
            const [revenueResult, totalOrders, totalProducts] = await Promise.all([
                // Revenue for this store
                prisma.order.aggregate({
                    _sum: { totalAmount: true },
                    where: {
                        storeId: store.id,
                        paymentStatus: 'PAID',
                        status: { notIn: ['CANCELLED', 'REFUNDED'] }
                    }
                }),
                // Total orders for this store
                prisma.order.count({
                    where: { storeId: store.id }
                }),
                // Total products for this store
                prisma.product.count({
                    where: { storeId: store.id }
                })
            ]);

            const revenue = Number(revenueResult._sum.totalAmount || 0);

            return {
                storeId: store.id,
                storeName: store.name,
                storeSlug: store.slug,
                currency: store.currency,
                status: store.status,
                totalRevenue: revenue,
                totalOrders,
                totalProducts
            };
        });

        // 3. Execute all queries
        const storeStats = await Promise.all(storeStatsPromises);

        // 4. Calculate totals
        const totals = {
            totalStores: stores.length,
            totalRevenue: storeStats.reduce((sum, s) => sum + s.totalRevenue, 0),
            totalOrders: storeStats.reduce((sum, s) => sum + s.totalOrders, 0),
            totalProducts: storeStats.reduce((sum, s) => sum + s.totalProducts, 0)
        };

        const result = {
            totals,
            stores: storeStats
        };

        // Cache for 15s
        await CacheService.set(cacheKey, result, { ttl: 15 });

        return result;
    }
}

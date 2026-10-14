/**
 * Admin Dashboard Service
 * Handles aggregated data for admin dashboard
 */

import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { systemSettingsService } from '@/core/admin/system-settings/service';
import { getTodayAndYesterdayRangeUtc, getStoreCalendarDays, normalizeTimezone } from '@/utils/timezone';
import { paymentReviewWhere } from '../order-management/service';

function calculateTrendPercent(current: number, previous: number): number {
    if (previous === 0) {
        return current === 0 ? 0 : 100;
    }

    const trend = ((current - previous) / previous) * 100;
    return Number(trend.toFixed(2));
}

export class AdminDashboardService {
    private static async getDashboardMetricSummary() {
        const cacheKey = 'stats:admin-dashboard:v2:metrics';
        const cached = await CacheService.get<any>(cacheKey);
        if (cached) return cached;

        const [currency, timezone] = await Promise.all([
            systemSettingsService.getShopCurrency(),
            systemSettingsService.getTimezone(),
        ]);
        const referenceDate = new Date();
        const { startOfTodayUtc, startOfYesterdayUtc } = getTodayAndYesterdayRangeUtc(timezone, referenceDate);
        const { days, endUtc } = getStoreCalendarDays(timezone, 14, referenceDate);

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
            yesterdayUsers,
            todayCustomers,
            yesterdayCustomers,
            paymentReviewCount,
            toShipCount,
            salesRows
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
                    createdAt: { gte: startOfTodayUtc, lt: endUtc }
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
                where: { createdAt: { gte: startOfTodayUtc, lt: endUtc } }
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
            }),
            prisma.user.count({ where: { role: 'USER', createdAt: { gte: startOfTodayUtc, lt: endUtc } } }),
            prisma.user.count({ where: { role: 'USER', createdAt: { gte: startOfYesterdayUtc, lt: startOfTodayUtc } } }),
            prisma.order.count({ where: { payments: { some: paymentReviewWhere() } } }),
            prisma.order.count({ where: { status: 'PROCESSING', paymentStatus: 'PAID' } }),
            // Prisma stores createdAt as a UTC timestamp without time zone.
            prisma.$queryRaw<Array<{ date: string; paidSales: unknown; orders: number }>>`
                SELECT to_char((("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${normalizeTimezone(timezone)})::date, 'YYYY-MM-DD') AS date,
                    COALESCE(SUM(CASE WHEN "paymentStatus" = 'PAID' AND status NOT IN ('CANCELLED', 'REFUNDED')
                        THEN "totalAmount" ELSE 0 END), 0) AS "paidSales", COUNT(*)::integer AS orders
                FROM public.orders
                WHERE "createdAt" >= (${days[0].startUtc}::timestamptz AT TIME ZONE 'UTC')
                  AND "createdAt" < (${endUtc}::timestamptz AT TIME ZONE 'UTC')
                GROUP BY 1 ORDER BY 1
            `
        ]);

        const totalRevenue = Number(revenueResult._sum.totalAmount || 0);
        const todayRevenue = Number(todayRevenueResult._sum.totalAmount || 0);
        const yesterdayRevenue = Number(yesterdayRevenueResult._sum.totalAmount || 0);

        const result = {
            today: { paidSales: todayRevenue, orders: todayOrders, newCustomers: todayCustomers },
            yesterday: { paidSales: yesterdayRevenue, orders: yesterdayOrders, newCustomers: yesterdayCustomers },
            attention: { paymentReviewCount, toShipCount },
            dailySales: days.map(day => {
                const row = salesRows.find(row => row.date === day.date);
                return { date: day.date, paidSales: Number(row?.paidSales ?? 0), orders: row?.orders ?? 0 };
            }),
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
        const cacheKey = `stats:admin-dashboard:v2:${include.slice().sort().join(',')}`;
        const cached = await CacheService.get<any>(cacheKey);
        if (cached) return cached;

        const { metrics, today, yesterday, attention, dailySales } = await this.getDashboardMetricSummary();
        const currency = metrics.currency;

        const promises: any[] = [
            prisma.order.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    status: true,
                    paymentStatus: true,
                    payments: { where: paymentReviewWhere(), select: { id: true }, take: 1 },
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
            today, yesterday, attention, dailySales,
            ordersByStatus,
            recentOrders: recentOrders.map((order: any) => ({
                id: order.id,
                status: order.status,
                paymentStatus: order.paymentStatus,
                requiresPaymentReview: order.payments.length > 0,
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

}

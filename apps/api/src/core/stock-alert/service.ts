/**
 * Stock Alert Service
 *
 * Manages stock alert creation, monitoring, and resolution
 */

import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import type {
  StockAlert,
  StockAlertDetail,
  StockAlertStats,
  StockAlertFilters,
  CreateStockAlertRequest,
  UpdateStockAlertRequest,
  ResolveStockAlertRequest,
  BulkResolveStockAlertsRequest,
  StockAlertType,
  StockAlertStatus,
} from '@jiffoo/shared';
import type {
  StockAlertListResult,
  AlertCheckResult,
  BulkAlertCheckResult,
} from './types';

export class StockAlertService {
  private static readonly CACHE_PREFIX = 'stock-alert:';
  private static readonly CACHE_TTL = 600; // 10 minutes

  /**
   * Get cache version for stock alerts
   */
  private static async getStockAlertVersion(): Promise<number> {
    const key = `${this.CACHE_PREFIX}version`;
    const version = await CacheService.get<number | string>(key);
    return version ? Number(version) : 0;
  }

  /**
   * Increment cache version (invalidates all cached stock alerts)
   */
  private static async incrementStockAlertVersion(): Promise<number> {
    const key = `${this.CACHE_PREFIX}version`;
    const version = await this.getStockAlertVersion();
    const newVersion = version + 1;
    await CacheService.set(key, newVersion, { ttl: 86400 }); // 24 hours
    return newVersion;
  }

  /**
   * Normalize filters for stable cache keys
   */
  private static normalizeFilters(filters: StockAlertFilters) {
    const validFilters: Record<string, any> = {};

    if (filters.warehouseId) validFilters.warehouseId = filters.warehouseId;
    if (filters.variantId) validFilters.variantId = filters.variantId;
    if (filters.productId) validFilters.productId = filters.productId;
    if (filters.alertType) validFilters.alertType = filters.alertType;
    if (filters.status) validFilters.status = filters.status;
    if (filters.dateFrom) validFilters.dateFrom = filters.dateFrom;
    if (filters.dateTo) validFilters.dateTo = filters.dateTo;
    if (filters.sortBy) validFilters.sortBy = filters.sortBy;
    if (filters.sortOrder) validFilters.sortOrder = filters.sortOrder;

    // Sort by key to ensure stable serialization
    return Object.keys(validFilters)
      .sort()
      .reduce((obj, key) => {
        obj[key] = validFilters[key];
        return obj;
      }, {} as Record<string, any>);
  }

  /**
   * Create a new stock alert
   */
  static async createAlert(data: CreateStockAlertRequest): Promise<StockAlert> {
    // Verify warehouse exists
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: data.warehouseId },
    });

    if (!warehouse) {
      throw new Error(`Warehouse not found: ${data.warehouseId}`);
    }

    // Verify variant exists
    const variant = await prisma.productVariant.findUnique({
      where: { id: data.variantId },
    });

    if (!variant) {
      throw new Error(`Variant not found: ${data.variantId}`);
    }

    // Get current inventory quantity
    const inventory = await prisma.warehouseInventory.findUnique({
      where: {
        warehouseId_variantId: {
          warehouseId: data.warehouseId,
          variantId: data.variantId,
        },
      },
    });

    const currentQuantity = inventory?.quantity || 0;

    // Create the alert
    const alert = await prisma.stockAlert.create({
      data: {
        warehouseId: data.warehouseId,
        variantId: data.variantId,
        alertType: data.alertType,
        threshold: data.threshold,
        quantity: currentQuantity,
        status: 'ACTIVE',
      },
    });

    // Invalidate cache
    await this.incrementStockAlertVersion();

    return {
      id: alert.id,
      warehouseId: alert.warehouseId,
      variantId: alert.variantId,
      alertType: alert.alertType as StockAlertType,
      threshold: alert.threshold,
      quantity: alert.quantity,
      status: alert.status as StockAlertStatus,
      resolvedAt: alert.resolvedAt?.toISOString(),
      createdAt: alert.createdAt.toISOString(),
      updatedAt: alert.updatedAt.toISOString(),
    };
  }

  /**
   * Get stock alerts with pagination and filtering
   */
  static async getAlerts(
    page = 1,
    limit = 20,
    filters: StockAlertFilters = {}
  ): Promise<StockAlertListResult> {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (filters.warehouseId) {
      where.warehouseId = filters.warehouseId;
    }

    if (filters.variantId) {
      where.variantId = filters.variantId;
    }

    if (filters.productId) {
      where.variant = {
        productId: filters.productId,
      };
    }

    if (filters.alertType) {
      where.alertType = filters.alertType;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
      };
    }

    // Build orderBy clause
    const orderBy: any = {};
    if (filters.sortBy && ['createdAt', 'updatedAt', 'threshold', 'quantity'].includes(filters.sortBy)) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    // Versioned Cache Key
    const version = await this.getStockAlertVersion();
    const normalizedFilters = this.normalizeFilters(filters);
    const filterHash = Buffer.from(JSON.stringify(normalizedFilters)).toString('base64');
    const cacheKey = `${this.CACHE_PREFIX}v${version}:${page}:${limit}:${filterHash}:list`;

    const cached = await CacheService.get<StockAlertListResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const [alerts, total] = await Promise.all([
      prisma.stockAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          variant: {
            select: {
              id: true,
              name: true,
              skuCode: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),
      prisma.stockAlert.count({ where }),
    ]);

    const result: StockAlertListResult = {
      alerts: alerts.map((alert) => ({
        id: alert.id,
        warehouseId: alert.warehouseId,
        variantId: alert.variantId,
        alertType: alert.alertType as StockAlertType,
        threshold: alert.threshold,
        quantity: alert.quantity,
        status: alert.status as StockAlertStatus,
        resolvedAt: alert.resolvedAt?.toISOString(),
        createdAt: alert.createdAt.toISOString(),
        updatedAt: alert.updatedAt.toISOString(),
        warehouse: alert.warehouse,
        variant: {
          id: alert.variant.id,
          name: alert.variant.name,
          skuCode: alert.variant.skuCode || undefined,
        },
        product: {
          id: alert.variant.product.id,
          name: alert.variant.product.name,
          sku: alert.variant.product.slug,
        },
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await CacheService.set(cacheKey, result, { ttl: this.CACHE_TTL });
    return result;
  }

  /**
   * Get a single stock alert by ID
   */
  static async getAlertById(alertId: string): Promise<StockAlertDetail | null> {
    // Check cache
    const version = await this.getStockAlertVersion();
    const cacheKey = `${this.CACHE_PREFIX}v${version}:${alertId}`;

    const cached = await CacheService.get<StockAlertDetail>(cacheKey);
    if (cached) {
      return cached;
    }

    const alert = await prisma.stockAlert.findUnique({
      where: { id: alertId },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        variant: {
          select: {
            id: true,
            name: true,
            skuCode: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!alert) {
      return null;
    }

    const result: StockAlertDetail = {
      id: alert.id,
      warehouseId: alert.warehouseId,
      variantId: alert.variantId,
      alertType: alert.alertType as StockAlertType,
      threshold: alert.threshold,
      quantity: alert.quantity,
      status: alert.status as StockAlertStatus,
      resolvedAt: alert.resolvedAt?.toISOString(),
      createdAt: alert.createdAt.toISOString(),
      updatedAt: alert.updatedAt.toISOString(),
      warehouse: alert.warehouse,
      variant: {
        id: alert.variant.id,
        name: alert.variant.name,
        skuCode: alert.variant.skuCode || undefined,
      },
      product: {
        id: alert.variant.product.id,
        name: alert.variant.product.name,
        sku: alert.variant.product.slug,
      },
    };

    await CacheService.set(cacheKey, result, { ttl: this.CACHE_TTL });
    return result;
  }

  /**
   * Update a stock alert
   */
  static async updateAlert(
    alertId: string,
    data: UpdateStockAlertRequest
  ): Promise<StockAlert> {
    const alert = await prisma.stockAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new Error(`Stock alert not found: ${alertId}`);
    }

    const updated = await prisma.stockAlert.update({
      where: { id: alertId },
      data: {
        ...(data.alertType && { alertType: data.alertType }),
        ...(data.threshold !== undefined && { threshold: data.threshold }),
        ...(data.status && { status: data.status }),
      },
    });

    // Invalidate cache
    await this.incrementStockAlertVersion();

    return {
      id: updated.id,
      warehouseId: updated.warehouseId,
      variantId: updated.variantId,
      alertType: updated.alertType as StockAlertType,
      threshold: updated.threshold,
      quantity: updated.quantity,
      status: updated.status as StockAlertStatus,
      resolvedAt: updated.resolvedAt?.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Resolve or dismiss a stock alert
   */
  static async resolveAlert(data: ResolveStockAlertRequest): Promise<StockAlert> {
    const alert = await prisma.stockAlert.findUnique({
      where: { id: data.alertId },
    });

    if (!alert) {
      throw new Error(`Stock alert not found: ${data.alertId}`);
    }

    const updated = await prisma.stockAlert.update({
      where: { id: data.alertId },
      data: {
        status: data.status,
        resolvedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.incrementStockAlertVersion();

    return {
      id: updated.id,
      warehouseId: updated.warehouseId,
      variantId: updated.variantId,
      alertType: updated.alertType as StockAlertType,
      threshold: updated.threshold,
      quantity: updated.quantity,
      status: updated.status as StockAlertStatus,
      resolvedAt: updated.resolvedAt?.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Bulk resolve or dismiss stock alerts
   */
  static async bulkResolveAlerts(
    data: BulkResolveStockAlertsRequest
  ): Promise<{ count: number }> {
    const result = await prisma.stockAlert.updateMany({
      where: {
        id: { in: data.alertIds },
        status: 'ACTIVE', // Only update active alerts
      },
      data: {
        status: data.status,
        resolvedAt: new Date(),
      },
    });

    // Invalidate cache
    await this.incrementStockAlertVersion();

    return { count: result.count };
  }

  /**
   * Delete a stock alert
   */
  static async deleteAlert(alertId: string): Promise<void> {
    const alert = await prisma.stockAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw new Error(`Stock alert not found: ${alertId}`);
    }

    await prisma.stockAlert.delete({
      where: { id: alertId },
    });

    // Invalidate cache
    await this.incrementStockAlertVersion();
  }

  /**
   * Check all warehouse inventory and create/resolve alerts based on thresholds
   *
   * This method scans all inventory across all warehouses and:
   * - Creates new alerts for items that fall below their thresholds
   * - Resolves existing alerts for items that are back above their thresholds
   */
  static async checkAlerts(): Promise<BulkAlertCheckResult> {
    // Get all warehouse inventory with low stock
    const inventories = await prisma.warehouseInventory.findMany({
      where: {
        warehouse: { isActive: true },
      },
      include: {
        warehouse: true,
        variant: {
          include: {
            product: true,
          },
        },
      },
    });

    const checkResults: AlertCheckResult[] = [];
    let alertsCreated = 0;
    let alertsResolved = 0;

    for (const inventory of inventories) {
      const currentQuantity = inventory.quantity;
      const threshold = inventory.lowStock || 10; // Default threshold if not set

      // Determine alert type based on quantity
      let alertType: StockAlertType;
      let shouldAlert = false;

      if (currentQuantity === 0) {
        alertType = 'OUT_OF_STOCK';
        shouldAlert = true;
      } else if (currentQuantity <= threshold) {
        alertType = 'LOW_STOCK';
        shouldAlert = true;
      } else {
        alertType = 'RESTOCK_NEEDED';
        shouldAlert = false;
      }

      // Check if an active alert already exists
      const existingAlert = await prisma.stockAlert.findFirst({
        where: {
          warehouseId: inventory.warehouseId,
          variantId: inventory.variantId,
          status: 'ACTIVE',
        },
      });

      if (shouldAlert && !existingAlert) {
        // Create new alert
        await prisma.stockAlert.create({
          data: {
            warehouseId: inventory.warehouseId,
            variantId: inventory.variantId,
            alertType,
            threshold,
            quantity: currentQuantity,
            status: 'ACTIVE',
          },
        });
        alertsCreated++;
      } else if (!shouldAlert && existingAlert) {
        // Resolve existing alert
        await prisma.stockAlert.update({
          where: { id: existingAlert.id },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
          },
        });
        alertsResolved++;
      } else if (shouldAlert && existingAlert) {
        // Update existing alert with current quantity
        await prisma.stockAlert.update({
          where: { id: existingAlert.id },
          data: {
            quantity: currentQuantity,
            alertType,
          },
        });
      }

      checkResults.push({
        warehouseId: inventory.warehouseId,
        variantId: inventory.variantId,
        currentQuantity,
        threshold,
        alertType,
        shouldAlert,
        existingAlertId: existingAlert?.id,
      });
    }

    // Invalidate cache
    await this.incrementStockAlertVersion();

    return {
      totalChecked: inventories.length,
      alertsCreated,
      alertsResolved,
      details: checkResults,
    };
  }

  /**
   * Get stock alert statistics
   */
  static async getAlertStats(): Promise<StockAlertStats> {
    // Check cache
    const version = await this.getStockAlertVersion();
    const cacheKey = `${this.CACHE_PREFIX}v${version}:stats`;

    const cached = await CacheService.get<StockAlertStats>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get all alerts
    const allAlerts = await prisma.stockAlert.findMany({
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
        variant: {
          select: {
            id: true,
            name: true,
            skuCode: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    const totalAlerts = allAlerts.length;
    const activeAlerts = allAlerts.filter((a) => a.status === 'ACTIVE').length;
    const resolvedAlerts = allAlerts.filter((a) => a.status === 'RESOLVED').length;
    const dismissedAlerts = allAlerts.filter((a) => a.status === 'DISMISSED').length;

    // Group by alert type
    const typeMap = new Map<string, number>();
    allAlerts.forEach((alert) => {
      const count = typeMap.get(alert.alertType) || 0;
      typeMap.set(alert.alertType, count + 1);
    });

    const alertsByType = Array.from(typeMap.entries()).map(([alertType, count]) => ({
      alertType: alertType as StockAlertType,
      count,
    }));

    // Group by warehouse (active alerts only)
    const warehouseMap = new Map<string, { name: string; count: number }>();
    allAlerts
      .filter((a) => a.status === 'ACTIVE')
      .forEach((alert) => {
        const existing = warehouseMap.get(alert.warehouseId);
        if (existing) {
          existing.count++;
        } else {
          warehouseMap.set(alert.warehouseId, {
            name: alert.warehouse.name,
            count: 1,
          });
        }
      });

    const alertsByWarehouse = Array.from(warehouseMap.entries()).map(
      ([warehouseId, { name, count }]) => ({
        warehouseId,
        warehouseName: name,
        activeCount: count,
      })
    );

    // Get recent alerts (last 10, active only)
    const recentAlerts = allAlerts
      .filter((a) => a.status === 'ACTIVE')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map((alert) => ({
        id: alert.id,
        warehouseId: alert.warehouseId,
        variantId: alert.variantId,
        alertType: alert.alertType as StockAlertType,
        threshold: alert.threshold,
        quantity: alert.quantity,
        status: alert.status as StockAlertStatus,
        resolvedAt: alert.resolvedAt?.toISOString(),
        createdAt: alert.createdAt.toISOString(),
        updatedAt: alert.updatedAt.toISOString(),
        warehouse: {
          id: alert.warehouse.id,
          name: alert.warehouse.name,
          code: alert.warehouse.id, // Using ID as code fallback
        },
        variant: {
          id: alert.variant.id,
          name: alert.variant.name,
          skuCode: alert.variant.skuCode || undefined,
        },
        product: {
          id: alert.variant.product.id,
          name: alert.variant.product.name,
          sku: alert.variant.product.slug,
        },
      }));

    const stats: StockAlertStats = {
      totalAlerts,
      activeAlerts,
      resolvedAlerts,
      dismissedAlerts,
      alertsByType,
      alertsByWarehouse,
      recentAlerts,
    };

    await CacheService.set(cacheKey, stats, { ttl: this.CACHE_TTL });
    return stats;
  }
}

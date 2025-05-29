import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { LoggerService, OperationType } from '@/core/logger/logger';
import {
  InventoryStatus,
  InventoryOperation,
  AlertType,
  InventoryRecord,
  InventoryAlert,
  InventoryConfig,
  InventoryStats,
  InventoryMovement,
  BulkInventoryOperation,
  InventoryQuery,
  InventoryReport,
  InventoryForecast
} from './types';

export class InventoryService {
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static readonly LOW_STOCK_THRESHOLD = 10;
  private static readonly OUT_OF_STOCK_THRESHOLD = 0;

  /**
   * 更新库存
   */
  static async updateInventory(movement: InventoryMovement): Promise<InventoryRecord> {
    const { productId, operation, quantity, reason, reference, operatorId } = movement;

    // 获取当前商品信息
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const previousStock = product.stock;
    let newStock = previousStock;

    // 根据操作类型计算新库存
    switch (operation) {
      case InventoryOperation.RESTOCK:
      case InventoryOperation.RETURN:
      case InventoryOperation.ADJUSTMENT:
        newStock = previousStock + quantity;
        break;
      case InventoryOperation.SALE:
      case InventoryOperation.DAMAGE:
      case InventoryOperation.RESERVE:
        newStock = previousStock - quantity;
        break;
      case InventoryOperation.RELEASE:
        newStock = previousStock + quantity;
        break;
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }

    // 确保库存不为负数
    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }

    // 开始事务
    const result = await prisma.$transaction(async (tx) => {
      // 更新商品库存
      await tx.product.update({
        where: { id: productId },
        data: { stock: newStock }
      });

      // 创建库存记录
      const record = await tx.inventoryRecord.create({
        data: {
          productId,
          operation,
          quantity,
          previousStock,
          newStock,
          reason,
          reference,
          operatorId
        }
      });

      return record;
    });

    // 检查库存警告
    await this.checkInventoryAlerts(productId, newStock);

    // 清除相关缓存
    await this.clearInventoryCache(productId);

    // 记录操作日志
    LoggerService.logOperation({
      userId: operatorId,
      operation: OperationType.UPDATE,
      resource: 'inventory',
      resourceId: productId,
      details: {
        operation,
        quantity,
        previousStock,
        newStock,
        reason,
        reference
      },
      timestamp: new Date(),
      success: true
    });

    return result;
  }

  /**
   * 批量库存操作
   */
  static async bulkUpdateInventory(bulkOperation: BulkInventoryOperation): Promise<InventoryRecord[]> {
    const { operations, reason, operatorId } = bulkOperation;
    const records: InventoryRecord[] = [];

    // 验证所有操作
    for (const operation of operations) {
      const product = await prisma.product.findUnique({
        where: { id: operation.productId }
      });

      if (!product) {
        throw new Error(`Product not found: ${operation.productId}`);
      }
    }

    // 执行批量操作
    for (const operation of operations) {
      try {
        const record = await this.updateInventory({
          ...operation,
          reason: reason || operation.reason,
          operatorId
        });
        records.push(record);
      } catch (error) {
        LoggerService.logError(error as Error, {
          context: 'bulk_inventory_update',
          productId: operation.productId,
          operation: operation.operation
        });
        throw error;
      }
    }

    LoggerService.logOperation({
      userId: operatorId,
      operation: OperationType.UPDATE,
      resource: 'inventory_bulk',
      resourceId: 'multiple',
      details: {
        operationsCount: operations.length,
        reason,
        productIds: operations.map(op => op.productId)
      },
      timestamp: new Date(),
      success: true
    });

    return records;
  }

  /**
   * 检查库存警告
   */
  static async checkInventoryAlerts(productId: string, currentStock: number): Promise<void> {
    const config = await this.getInventoryConfig(productId);
    const alerts: Partial<InventoryAlert>[] = [];

    // 检查缺货
    if (currentStock <= this.OUT_OF_STOCK_THRESHOLD) {
      alerts.push({
        productId,
        alertType: AlertType.OUT_OF_STOCK,
        threshold: this.OUT_OF_STOCK_THRESHOLD,
        currentStock,
        message: `Product ${productId} is out of stock`,
        isResolved: false
      });
    }
    // 检查低库存
    else if (currentStock <= (config?.minStock || this.LOW_STOCK_THRESHOLD)) {
      alerts.push({
        productId,
        alertType: AlertType.LOW_STOCK,
        threshold: config?.minStock || this.LOW_STOCK_THRESHOLD,
        currentStock,
        message: `Product ${productId} is running low on stock`,
        isResolved: false
      });
    }

    // 检查超库存
    if (config?.maxStock && currentStock > config.maxStock) {
      alerts.push({
        productId,
        alertType: AlertType.OVERSTOCK,
        threshold: config.maxStock,
        currentStock,
        message: `Product ${productId} is overstocked`,
        isResolved: false
      });
    }

    // 创建警告
    for (const alert of alerts) {
      await this.createInventoryAlert(alert as Omit<InventoryAlert, 'id' | 'createdAt' | 'updatedAt'>);
    }
  }

  /**
   * 创建库存警告
   */
  static async createInventoryAlert(alertData: Omit<InventoryAlert, 'id' | 'createdAt' | 'updatedAt'>): Promise<InventoryAlert> {
    // 检查是否已存在相同的未解决警告
    const existingAlert = await prisma.inventoryAlert.findFirst({
      where: {
        productId: alertData.productId,
        alertType: alertData.alertType,
        isResolved: false
      }
    });

    if (existingAlert) {
      // 更新现有警告
      return await prisma.inventoryAlert.update({
        where: { id: existingAlert.id },
        data: {
          currentStock: alertData.currentStock,
          message: alertData.message,
          updatedAt: new Date()
        }
      });
    }

    // 创建新警告
    const alert = await prisma.inventoryAlert.create({
      data: alertData
    });

    // 发送通知
    await this.sendInventoryNotification(alert);

    LoggerService.logSystem('Inventory alert created', {
      alertId: alert.id,
      productId: alert.productId,
      alertType: alert.alertType,
      currentStock: alert.currentStock
    });

    return alert;
  }

  /**
   * 发送库存通知
   */
  static async sendInventoryNotification(alert: InventoryAlert): Promise<void> {
    try {
      const { NotificationService } = await import('@/core/notifications/service');
      
      const product = await prisma.product.findUnique({
        where: { id: alert.productId },
        select: { name: true }
      });

      await NotificationService.sendInventoryAlert({
        productId: alert.productId,
        productName: product?.name || 'Unknown Product',
        alertType: alert.alertType,
        currentStock: alert.currentStock,
        threshold: alert.threshold,
        message: alert.message
      });
    } catch (error) {
      LoggerService.logError(error as Error, {
        context: 'inventory_notification',
        alertId: alert.id
      });
    }
  }

  /**
   * 获取库存配置
   */
  static async getInventoryConfig(productId: string): Promise<InventoryConfig | null> {
    const cacheKey = `inventory_config:${productId}`;
    
    const cached = await CacheService.get<InventoryConfig>(cacheKey, 'inventory:');
    if (cached) {
      return cached;
    }

    const config = await prisma.inventoryConfig.findUnique({
      where: { productId }
    });

    if (config) {
      await CacheService.set(cacheKey, config, { ttl: this.CACHE_TTL, prefix: 'inventory:' });
    }

    return config;
  }

  /**
   * 设置库存配置
   */
  static async setInventoryConfig(productId: string, config: Partial<InventoryConfig>): Promise<InventoryConfig> {
    const result = await prisma.inventoryConfig.upsert({
      where: { productId },
      update: config,
      create: {
        productId,
        ...config
      } as any
    });

    // 清除缓存
    await CacheService.delete(`inventory_config:${productId}`, 'inventory:');

    return result;
  }

  /**
   * 获取库存统计
   */
  static async getInventoryStats(): Promise<InventoryStats> {
    const cacheKey = 'inventory_stats';
    
    const cached = await CacheService.getStats(cacheKey);
    if (cached) {
      return cached;
    }

    const [
      totalProducts,
      inStockProducts,
      lowStockProducts,
      outOfStockProducts,
      totalValue,
      alerts
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { stock: { gt: this.LOW_STOCK_THRESHOLD } } }),
      prisma.product.count({ 
        where: { 
          stock: { 
            gt: this.OUT_OF_STOCK_THRESHOLD, 
            lte: this.LOW_STOCK_THRESHOLD 
          } 
        } 
      }),
      prisma.product.count({ where: { stock: { lte: this.OUT_OF_STOCK_THRESHOLD } } }),
      prisma.product.aggregate({
        _sum: { price: true }
      }),
      prisma.inventoryAlert.groupBy({
        by: ['alertType', 'isResolved'],
        _count: { alertType: true }
      })
    ]);

    // 计算平均库存水平
    const stockData = await prisma.product.aggregate({
      _avg: { stock: true }
    });

    // 处理警告统计
    const alertStats = {
      total: 0,
      unresolved: 0,
      byType: {} as Record<AlertType, number>
    };

    alerts.forEach(alert => {
      alertStats.total += alert._count.alertType;
      if (!alert.isResolved) {
        alertStats.unresolved += alert._count.alertType;
      }
      alertStats.byType[alert.alertType] = (alertStats.byType[alert.alertType] || 0) + alert._count.alertType;
    });

    const stats: InventoryStats = {
      totalProducts,
      inStockProducts,
      lowStockProducts,
      outOfStockProducts,
      totalValue: totalValue._sum.price || 0,
      averageStockLevel: stockData._avg.stock || 0,
      turnoverRate: 0, // 需要更复杂的计算
      alerts: alertStats
    };

    await CacheService.setStats(cacheKey, stats, this.CACHE_TTL);
    return stats;
  }

  /**
   * 清除库存缓存
   */
  static async clearInventoryCache(productId?: string): Promise<void> {
    if (productId) {
      await CacheService.delete(`inventory_config:${productId}`, 'inventory:');
      await CacheService.delete(`product:${productId}`, 'product:');
    }
    
    await CacheService.deletePattern('inventory:inventory_stats*');
    await CacheService.deletePattern('stats:inventory_stats*');
  }

  /**
   * 获取库存记录
   */
  static async getInventoryRecords(query: InventoryQuery): Promise<{
    records: InventoryRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc', ...filters } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (filters.productId) where.productId = filters.productId;
    if (filters.operation) where.operation = filters.operation;
    if (filters.operatorId) where.operatorId = filters.operatorId;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [records, total] = await Promise.all([
      prisma.inventoryRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          product: {
            select: { name: true }
          }
        }
      }),
      prisma.inventoryRecord.count({ where })
    ]);

    return {
      records,
      total,
      page,
      limit
    };
  }
}

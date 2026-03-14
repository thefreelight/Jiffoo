/**
 * Warehouse Service
 *
 * Handles warehouse CRUD operations and inventory management.
 */

import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { WarehouseListResult, WarehouseWithStats, WarehouseStats } from './types';
import type {
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
  WarehouseFilters,
} from '@jiffoo/shared';

export class WarehouseService {
  private static readonly CACHE_PREFIX = 'warehouse:';
  private static readonly CACHE_TTL = 600; // 10 minutes

  /**
   * Normalize filters for stable cache keys
   */
  private static normalizeFilters(filters: WarehouseFilters) {
    const validFilters: Record<string, any> = {};

    if (filters.search?.trim()) validFilters.search = filters.search.trim();
    if (filters.isActive !== undefined) validFilters.isActive = filters.isActive;

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
   * Get warehouse version for cache invalidation
   */
  static async getWarehouseVersion(): Promise<number> {
    const key = `${this.CACHE_PREFIX}version`;
    const version = await CacheService.get<number | string>(key);
    return version ? Number(version) : 0;
  }

  /**
   * Increment warehouse version (invalidates all warehouse caches)
   */
  static async incrementWarehouseVersion(): Promise<number> {
    const key = `${this.CACHE_PREFIX}version`;
    const version = await this.getWarehouseVersion();
    const newVersion = version + 1;
    await CacheService.set(key, newVersion, { ttl: 86400 }); // 24 hours
    return newVersion;
  }

  /**
   * Create a new warehouse
   */
  static async createWarehouse(data: CreateWarehouseRequest) {
    // Check if code already exists
    const existing = await prisma.warehouse.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new Error(`Warehouse with code "${data.code}" already exists`);
    }

    // If this is marked as default, unset any existing default
    if (data.isDefault) {
      await prisma.warehouse.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        name: data.name,
        code: data.code,
        address: data.address,
        isActive: data.isActive ?? true,
        isDefault: data.isDefault ?? false,
      },
    });

    // Invalidate cache
    await this.incrementWarehouseVersion();

    return warehouse;
  }

  /**
   * Get warehouses list with pagination and filtering
   */
  static async getWarehouses(
    page = 1,
    limit = 10,
    filters: WarehouseFilters = {}
  ): Promise<WarehouseListResult> {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
        { address: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    // Build orderBy
    const orderBy: any = {};
    if (filters.sortBy && ['name', 'code', 'createdAt'].includes(filters.sortBy)) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    // Check cache
    const version = await this.getWarehouseVersion();
    const normalizedFilters = this.normalizeFilters(filters);
    const filterHash = Buffer.from(JSON.stringify(normalizedFilters)).toString('base64');
    const cacheKey = `${this.CACHE_PREFIX}list:v${version}:${page}:${limit}:${filterHash}`;

    const cached = await CacheService.get<WarehouseListResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      prisma.warehouse.count({ where }),
    ]);

    const result: WarehouseListResult = {
      warehouses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    // Cache result
    await CacheService.set(cacheKey, result, { ttl: this.CACHE_TTL });

    return result;
  }

  /**
   * Get warehouse by ID
   */
  static async getWarehouseById(id: string) {
    // Check cache
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw new Error(`Warehouse with ID "${id}" not found`);
    }

    // Cache result
    await CacheService.set(cacheKey, warehouse, { ttl: this.CACHE_TTL });

    return warehouse;
  }

  /**
   * Get warehouse by code
   */
  static async getWarehouseByCode(code: string) {
    const cacheKey = `${this.CACHE_PREFIX}code:${code}`;
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const warehouse = await prisma.warehouse.findUnique({
      where: { code },
    });

    if (!warehouse) {
      throw new Error(`Warehouse with code "${code}" not found`);
    }

    // Cache result
    await CacheService.set(cacheKey, warehouse, { ttl: this.CACHE_TTL });

    return warehouse;
  }

  /**
   * Get warehouse with inventory stats
   */
  static async getWarehouseWithStats(id: string): Promise<WarehouseWithStats> {
    const warehouse = await this.getWarehouseById(id);

    const [inventoryCount, totalQuantity, allInventory] = await Promise.all([
      prisma.warehouseInventory.count({
        where: { warehouseId: id },
      }),
      prisma.warehouseInventory.aggregate({
        where: { warehouseId: id },
        _sum: { quantity: true },
      }),
      prisma.warehouseInventory.findMany({
        where: { warehouseId: id },
        select: { quantity: true, lowStock: true },
      }),
    ]);

    // Calculate low stock count by comparing quantity with lowStock field
    const lowStockCount = allInventory.filter(
      (inv) => inv.quantity <= inv.lowStock && inv.quantity > 0
    ).length;

    return {
      ...(warehouse as any),
      inventoryCount,
      totalQuantity: totalQuantity._sum.quantity || 0,
      lowStockCount,
    };
  }

  /**
   * Update warehouse
   */
  static async updateWarehouse(id: string, data: UpdateWarehouseRequest) {
    // Check if warehouse exists
    const existing = await prisma.warehouse.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Warehouse with ID "${id}" not found`);
    }

    // If updating code, check for conflicts
    if (data.code && data.code !== existing.code) {
      const codeExists = await prisma.warehouse.findUnique({
        where: { code: data.code },
      });

      if (codeExists) {
        throw new Error(`Warehouse with code "${data.code}" already exists`);
      }
    }

    // If this is marked as default, unset any existing default
    if (data.isDefault) {
      await prisma.warehouse.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    });

    // Invalidate cache
    await this.incrementWarehouseVersion();
    await CacheService.delete(`${this.CACHE_PREFIX}${id}`);
    if (existing.code) {
      await CacheService.delete(`${this.CACHE_PREFIX}code:${existing.code}`);
    }
    if (data.code && data.code !== existing.code) {
      await CacheService.delete(`${this.CACHE_PREFIX}code:${data.code}`);
    }

    return warehouse;
  }

  /**
   * Delete warehouse
   */
  static async deleteWarehouse(id: string) {
    // Check if warehouse exists
    const existing = await prisma.warehouse.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Warehouse with ID "${id}" not found`);
    }

    // Check if warehouse has inventory
    const inventoryCount = await prisma.warehouseInventory.count({
      where: { warehouseId: id },
    });

    if (inventoryCount > 0) {
      throw new Error(
        `Cannot delete warehouse "${existing.name}" because it has ${inventoryCount} inventory records`
      );
    }

    // Delete warehouse (cascade will handle related records)
    await prisma.warehouse.delete({
      where: { id },
    });

    // Invalidate cache
    await this.incrementWarehouseVersion();
    await CacheService.delete(`${this.CACHE_PREFIX}${id}`);
    if (existing.code) {
      await CacheService.delete(`${this.CACHE_PREFIX}code:${existing.code}`);
    }

    return { success: true };
  }

  /**
   * Set default warehouse
   */
  static async setDefaultWarehouse(id: string) {
    // Check if warehouse exists
    const existing = await prisma.warehouse.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Warehouse with ID "${id}" not found`);
    }

    // Unset any existing default
    await prisma.warehouse.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    // Set new default
    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: { isDefault: true },
    });

    // Invalidate cache
    await this.incrementWarehouseVersion();

    return warehouse;
  }

  /**
   * Get default warehouse
   */
  static async getDefaultWarehouse() {
    const cacheKey = `${this.CACHE_PREFIX}default`;
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const warehouse = await prisma.warehouse.findFirst({
      where: { isDefault: true, isActive: true },
    });

    if (!warehouse) {
      // If no default, return the first active warehouse
      const firstActive = await prisma.warehouse.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      if (firstActive) {
        await CacheService.set(cacheKey, firstActive, { ttl: this.CACHE_TTL });
        return firstActive;
      }

      throw new Error('No active warehouse found');
    }

    await CacheService.set(cacheKey, warehouse, { ttl: this.CACHE_TTL });

    return warehouse;
  }

  /**
   * Get warehouse statistics
   */
  static async getWarehouseStats(): Promise<WarehouseStats> {
    const cacheKey = `${this.CACHE_PREFIX}stats`;
    const cached = await CacheService.get<WarehouseStats>(cacheKey);
    if (cached) {
      return cached;
    }

    const [totalWarehouses, activeWarehouses, inventoryStats, allInventory, outOfStockItems] =
      await Promise.all([
        prisma.warehouse.count(),
        prisma.warehouse.count({ where: { isActive: true } }),
        prisma.warehouseInventory.aggregate({
          _count: true,
          _sum: { quantity: true },
        }),
        prisma.warehouseInventory.findMany({
          select: { quantity: true, lowStock: true },
        }),
        prisma.warehouseInventory.count({
          where: { quantity: 0 },
        }),
      ]);

    // Calculate low stock items by comparing quantity with lowStock field
    const lowStockItems = allInventory.filter(
      (inv) => inv.quantity <= inv.lowStock && inv.quantity > 0
    ).length;

    // Get breakdown by warehouse
    const warehouses = await prisma.warehouse.findMany({
      where: { isActive: true },
      include: {
        warehouseInventories: {
          select: {
            quantity: true,
            lowStock: true,
          },
        },
      },
    });

    const warehouseBreakdown = warehouses.map((warehouse) => ({
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      totalItems: warehouse.warehouseInventories.length,
      totalQuantity: warehouse.warehouseInventories.reduce(
        (sum, inv) => sum + inv.quantity,
        0
      ),
      lowStockCount: warehouse.warehouseInventories.filter(
        (inv) => inv.quantity <= inv.lowStock && inv.quantity > 0
      ).length,
    }));

    const stats: WarehouseStats = {
      totalWarehouses,
      activeWarehouses,
      totalInventory: inventoryStats._count,
      totalQuantity: inventoryStats._sum.quantity || 0,
      lowStockItems,
      outOfStockItems,
      warehouseBreakdown,
    };

    await CacheService.set(cacheKey, stats, { ttl: this.CACHE_TTL });

    return stats;
  }
}

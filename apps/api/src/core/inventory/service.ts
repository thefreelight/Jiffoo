// @ts-nocheck
/**
 * Inventory Service
 *
 * Handles multi-warehouse inventory tracking, adjustments, and history.
 */

import { prisma } from '@/config/database';
import { Prisma } from '@prisma/client';
import { CacheService } from '@/core/cache/service';
import { WarehouseService } from '@/core/warehouse/service';
import {
  InventoryListResult,
  InventoryWithDetails,
  InventoryHistoryResult,
  AvailableStockResult,
  InventoryTransferResult,
  InventoryTransferWithDetails,
} from './types';
import type {
  WarehouseInventoryFilters,
  CreateInventoryAdjustmentRequest,
  InventoryAdjustmentFilters,
  CreateInventoryTransferRequest,
  UpdateInventoryTransferRequest,
  ApproveInventoryTransferRequest,
  CancelInventoryTransferRequest,
  InventoryTransferFilters,
  BulkInventoryUpdate,
  ImportInventoryResult,
} from '@jiffoo/shared';

function parseJsonValue(value: unknown): unknown {
  if (!value) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export class InventoryService {
  private static readonly CACHE_PREFIX = 'inventory:';
  private static readonly CACHE_TTL = 600; // 10 minutes

  static async getAvailableStockByVariantIds(
    variantIds: string[],
    options?: { warehouseId?: string }
  ): Promise<Map<string, number>> {
    if (variantIds.length === 0) return new Map();
    const where: Prisma.WarehouseInventoryWhereInput = {
      variantId: { in: variantIds },
    };
    if (options?.warehouseId) {
      where.warehouseId = options.warehouseId;
    } else {
      where.warehouse = { isActive: true };
    }

    const rows = await prisma.warehouseInventory.groupBy({
      by: ['variantId'],
      where,
      _sum: { available: true },
    });

    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.variantId, row._sum.available ?? 0);
    }
    return map;
  }

  static async getVariantIdsByAvailability(options: {
    minAvailable?: number;
    maxAvailable?: number;
    warehouseId?: string;
    onlyActiveVariants?: boolean;
  }): Promise<string[]> {
    const { minAvailable, maxAvailable, warehouseId, onlyActiveVariants } = options;
    if (minAvailable === undefined && maxAvailable === undefined) {
      return [];
    }

    const where: Prisma.WarehouseInventoryWhereInput = {};
    if (warehouseId) {
      where.warehouseId = warehouseId;
    } else {
      where.warehouse = { isActive: true };
    }
    if (onlyActiveVariants) {
      where.variant = { isActive: true };
    }

    const having: Prisma.WarehouseInventoryScalarWhereWithAggregatesInput = {
      available: {
        _sum: {
          ...(minAvailable !== undefined ? { gte: minAvailable } : {}),
          ...(maxAvailable !== undefined ? { lte: maxAvailable } : {}),
        },
      },
    };

    const rows = await prisma.warehouseInventory.groupBy({
      by: ['variantId'],
      where,
      _sum: { available: true },
      having,
    });

    return rows.map((row) => row.variantId);
  }

  static async decrementStock(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
    warehouseId?: string
  ): Promise<void> {
    const targetWarehouseId = warehouseId ?? (await WarehouseService.getDefaultWarehouse()).id;
    const result = await tx.warehouseInventory.updateMany({
      where: {
        warehouseId: targetWarehouseId,
        variantId,
        available: { gte: quantity },
        quantity: { gte: quantity },
      },
      data: {
        quantity: { decrement: quantity },
        available: { decrement: quantity },
      },
    });

    if (result.count === 0) {
      throw new Error('Insufficient stock');
    }
  }

  static async incrementStock(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
    warehouseId?: string
  ): Promise<void> {
    const targetWarehouseId = warehouseId ?? (await WarehouseService.getDefaultWarehouse()).id;
    const existing = await tx.warehouseInventory.findUnique({
      where: {
        warehouseId_variantId: {
          warehouseId: targetWarehouseId,
          variantId,
        },
      },
    });

    if (existing) {
      await tx.warehouseInventory.update({
        where: {
          warehouseId_variantId: {
            warehouseId: targetWarehouseId,
            variantId,
          },
        },
        data: {
          quantity: { increment: quantity },
          available: { increment: quantity },
        },
      });
    } else {
      await tx.warehouseInventory.create({
        data: {
          warehouseId: targetWarehouseId,
          variantId,
          quantity,
          reserved: 0,
          available: quantity,
          lowStock: 10,
        },
      });
    }

  }

  static async setStock(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
    warehouseId?: string
  ): Promise<void> {
    const targetWarehouseId = warehouseId ?? (await WarehouseService.getDefaultWarehouse()).id;
    const normalizedQuantity = Math.max(0, Math.trunc(quantity));

    const existing = await tx.warehouseInventory.findUnique({
      where: {
        warehouseId_variantId: {
          warehouseId: targetWarehouseId,
          variantId,
        },
      },
    });

    if (existing) {
      const reserved = existing.reserved ?? 0;
      const available = Math.max(0, normalizedQuantity - reserved);
      await tx.warehouseInventory.update({
        where: {
          warehouseId_variantId: {
            warehouseId: targetWarehouseId,
            variantId,
          },
        },
        data: {
          quantity: normalizedQuantity,
          available,
        },
      });
    } else {
      await tx.warehouseInventory.create({
        data: {
          warehouseId: targetWarehouseId,
          variantId,
          quantity: normalizedQuantity,
          reserved: 0,
          available: normalizedQuantity,
          lowStock: 10,
        },
      });
    }

  }

  /**
   * Normalize filters for stable cache keys
   */
  private static normalizeInventoryFilters(filters: WarehouseInventoryFilters) {
    const validFilters: Record<string, any> = {};

    if (filters.warehouseId) validFilters.warehouseId = filters.warehouseId;
    if (filters.variantId) validFilters.variantId = filters.variantId;
    if (filters.productId) validFilters.productId = filters.productId;
    if (filters.lowStock !== undefined) validFilters.lowStock = filters.lowStock;
    if (filters.outOfStock !== undefined) validFilters.outOfStock = filters.outOfStock;

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
   * Normalize adjustment filters for stable cache keys
   */
  private static normalizeAdjustmentFilters(filters: InventoryAdjustmentFilters) {
    const validFilters: Record<string, any> = {};

    if (filters.warehouseId) validFilters.warehouseId = filters.warehouseId;
    if (filters.variantId) validFilters.variantId = filters.variantId;
    if (filters.productId) validFilters.productId = filters.productId;
    if (filters.type) validFilters.type = filters.type;
    if (filters.userId) validFilters.userId = filters.userId;
    if (filters.startDate) validFilters.startDate = filters.startDate;
    if (filters.endDate) validFilters.endDate = filters.endDate;

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
   * Get inventory version for cache invalidation
   */
  static async getInventoryVersion(): Promise<number> {
    const key = `${this.CACHE_PREFIX}version`;
    const version = await CacheService.get<number | string>(key);
    return version ? Number(version) : 0;
  }

  /**
   * Increment inventory version (invalidates all inventory caches)
   */
  static async incrementInventoryVersion(): Promise<number> {
    const key = `${this.CACHE_PREFIX}version`;
    const version = await this.getInventoryVersion();
    const newVersion = version + 1;
    await CacheService.set(key, newVersion, { ttl: 86400 }); // 24 hours
    return newVersion;
  }

  /**
   * Get inventory for a specific variant across all warehouses
   */
  static async getInventoryByVariant(
    variantId: string,
    includeInactive = false
  ): Promise<InventoryWithDetails[]> {
    // Check cache
    const version = await this.getInventoryVersion();
    const cacheKey = `${this.CACHE_PREFIX}v${version}:variant:${variantId}:inactive:${includeInactive}`;
    const cached = await CacheService.get<InventoryWithDetails[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Build query
    const where: any = { variantId };
    if (!includeInactive) {
      where.warehouse = { isActive: true };
    }

    const inventories = await prisma.warehouseInventory.findMany({
      where,
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
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
              },
            },
          },
        },
      },
      orderBy: [{ warehouse: { isDefault: 'desc' } }, { warehouse: { name: 'asc' } }],
    });

    // Transform to match interface
    const result: InventoryWithDetails[] = inventories.map((inv) => ({
      id: inv.id,
      warehouseId: inv.warehouseId,
      variantId: inv.variantId,
      quantity: inv.quantity,
      reserved: inv.reserved,
      available: inv.available,
      lowStock: inv.lowStock,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
      warehouse: inv.warehouse
        ? {
            id: inv.warehouse.id,
            name: inv.warehouse.name,
            code: inv.warehouse.code,
          }
        : undefined,
      variant: inv.variant
        ? {
            id: inv.variant.id,
            name: inv.variant.name,
            skuCode: inv.variant.skuCode || undefined,
          }
        : undefined,
      product: inv.variant?.product
        ? {
            id: inv.variant.product.id,
            name: inv.variant.product.name,
          }
        : undefined,
    }));

    // Cache result
    await CacheService.set(cacheKey, result, { ttl: this.CACHE_TTL });

    return result;
  }

  /**
   * Get all inventory for a warehouse with pagination and filtering
   */
  static async getInventoryByWarehouse(
    warehouseId: string,
    page = 1,
    limit = 20,
    filters: WarehouseInventoryFilters = {}
  ): Promise<InventoryListResult> {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { warehouseId };

    if (filters.variantId) {
      where.variantId = filters.variantId;
    }

    if (filters.productId) {
      where.variant = {
        productId: filters.productId,
      };
    }

    if (filters.lowStock) {
      // Low stock: quantity > 0 AND quantity <= lowStock
      // Note: Prisma doesn't support field-to-field comparison in WHERE
      // We'll filter in memory after fetching
    }

    if (filters.outOfStock) {
      where.quantity = { lte: 0 };
    }

    // Build orderBy
    const orderBy: any = {};
    if (filters.sortBy && ['quantity', 'available', 'reserved', 'createdAt'].includes(filters.sortBy)) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    // Check cache
    const version = await this.getInventoryVersion();
    const normalizedFilters = this.normalizeInventoryFilters({ ...filters, warehouseId });
    const filterHash = Buffer.from(JSON.stringify(normalizedFilters)).toString('base64');
    const cacheKey = `${this.CACHE_PREFIX}v${version}:list:${page}:${limit}:${filterHash}`;
    const cached = await CacheService.get<InventoryListResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch data
    let [items, total] = await Promise.all([
      prisma.warehouseInventory.findMany({
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
                },
              },
            },
          },
        },
      }),
      prisma.warehouseInventory.count({ where }),
    ]);

    // Apply low stock filter in memory if needed
    if (filters.lowStock) {
      items = items.filter((item) => item.quantity > 0 && item.quantity <= item.lowStock);
      total = items.length;
    }

    // Transform to match interface
    const transformedItems = items.map((inv) => ({
      id: inv.id,
      warehouseId: inv.warehouseId,
      variantId: inv.variantId,
      quantity: inv.quantity,
      reserved: inv.reserved,
      available: inv.available,
      lowStock: inv.lowStock,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
    }));

    const result: InventoryListResult = {
      items: transformedItems,
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
   * Adjust inventory quantity and create audit record
   */
  static async adjustInventory(data: CreateInventoryAdjustmentRequest) {
    // Validate warehouse and variant exist
    const [warehouse, variant] = await Promise.all([
      prisma.warehouse.findUnique({ where: { id: data.warehouseId } }),
      prisma.productVariant.findUnique({ where: { id: data.variantId } }),
    ]);

    if (!warehouse) {
      throw new Error(`Warehouse with ID "${data.warehouseId}" not found`);
    }

    if (!variant) {
      throw new Error(`Variant with ID "${data.variantId}" not found`);
    }

    // Validate quantity is not zero
    if (data.quantity === 0) {
      throw new Error('Adjustment quantity cannot be zero');
    }

    // Use transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get or create warehouse inventory record
      let inventory = await tx.warehouseInventory.findUnique({
        where: {
          warehouseId_variantId: {
            warehouseId: data.warehouseId,
            variantId: data.variantId,
          },
        },
      });

      if (!inventory) {
        // Create new inventory record with initial quantity
        inventory = await tx.warehouseInventory.create({
          data: {
            warehouseId: data.warehouseId,
            variantId: data.variantId,
            quantity: Math.max(0, data.quantity), // Ensure non-negative
            reserved: 0,
            available: Math.max(0, data.quantity),
            lowStock: 10, // Default threshold
          },
        });
      } else {
        // Update existing inventory
        const newQuantity = Math.max(0, inventory.quantity + data.quantity);
        const newAvailable = Math.max(0, newQuantity - inventory.reserved);

        inventory = await tx.warehouseInventory.update({
          where: { id: inventory.id },
          data: {
            quantity: newQuantity,
            available: newAvailable,
          },
        });
      }

      // Create adjustment record for audit trail
      const adjustment = await tx.inventoryAdjustment.create({
        data: {
          warehouseId: data.warehouseId,
          variantId: data.variantId,
          type: data.type,
          quantity: data.quantity,
          reason: data.reason,
          notes: data.notes,
          userId: data.userId,
          referenceId: data.referenceId,
          metadata: data.metadata ?? undefined,
        },
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
                },
              },
            },
          },
        },
      });

      return { inventory, adjustment };
    });

    // Invalidate cache
    await this.incrementInventoryVersion();

    return result;
  }

  /**
   * Get inventory adjustment history with pagination and filtering
   */
  static async getInventoryHistory(
    page = 1,
    limit = 20,
    filters: InventoryAdjustmentFilters = {}
  ): Promise<InventoryHistoryResult> {
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

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    // Build orderBy
    const orderBy: any = {};
    if (filters.sortBy && ['type', 'quantity', 'createdAt'].includes(filters.sortBy)) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    // Check cache
    const version = await this.getInventoryVersion();
    const normalizedFilters = this.normalizeAdjustmentFilters(filters);
    const filterHash = Buffer.from(JSON.stringify(normalizedFilters)).toString('base64');
    const cacheKey = `${this.CACHE_PREFIX}v${version}:history:${page}:${limit}:${filterHash}`;
    const cached = await CacheService.get<InventoryHistoryResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch data
    const [adjustments, total] = await Promise.all([
      prisma.inventoryAdjustment.findMany({
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
                },
              },
            },
          },
        },
      }),
      prisma.inventoryAdjustment.count({ where }),
    ]);

    // Transform to match interface
    const items = adjustments.map((adj) => ({
      id: adj.id,
      warehouseId: adj.warehouseId,
      variantId: adj.variantId,
      type: adj.type as any,
      quantity: adj.quantity,
      reason: adj.reason || undefined,
      notes: adj.notes || undefined,
      userId: adj.userId || undefined,
      referenceId: adj.referenceId || undefined,
      metadata: parseJsonValue(adj.metadata),
      createdAt: adj.createdAt.toISOString(),
      warehouse: adj.warehouse
        ? {
            id: adj.warehouse.id,
            name: adj.warehouse.name,
            code: adj.warehouse.code,
          }
        : undefined,
      variant: adj.variant
        ? {
            id: adj.variant.id,
            name: adj.variant.name,
            skuCode: adj.variant.skuCode || undefined,
          }
        : undefined,
      product: adj.variant?.product
        ? {
            id: adj.variant.product.id,
            name: adj.variant.product.name,
          }
        : undefined,
    }));

    const result: InventoryHistoryResult = {
      items,
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
   * Calculate available stock for a variant across all warehouses
   */
  static async calculateAvailableStock(variantId: string): Promise<AvailableStockResult> {
    // Check cache
    const version = await this.getInventoryVersion();
    const cacheKey = `${this.CACHE_PREFIX}v${version}:available:${variantId}`;
    const cached = await CacheService.get<AvailableStockResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch inventory across all active warehouses
    const inventories = await prisma.warehouseInventory.findMany({
      where: {
        variantId,
        warehouse: { isActive: true },
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    // Calculate totals
    let totalQuantity = 0;
    let totalReserved = 0;
    let totalAvailable = 0;

    const warehouseBreakdown = inventories.map((inv) => {
      totalQuantity += inv.quantity;
      totalReserved += inv.reserved;
      totalAvailable += inv.available;

      return {
        warehouseId: inv.warehouseId,
        warehouseName: inv.warehouse.name,
        quantity: inv.quantity,
        reserved: inv.reserved,
        available: inv.available,
      };
    });

    const result: AvailableStockResult = {
      variantId,
      totalQuantity,
      totalReserved,
      totalAvailable,
      warehouseBreakdown,
    };

    // Cache result
    await CacheService.set(cacheKey, result, { ttl: this.CACHE_TTL });

    return result;
  }

  /**
   * Create an inventory transfer between warehouses
   */
  static async createInventoryTransfer(data: CreateInventoryTransferRequest) {
    // Validate warehouses and variant exist
    const [fromWarehouse, toWarehouse, variant] = await Promise.all([
      prisma.warehouse.findUnique({ where: { id: data.fromWarehouseId } }),
      prisma.warehouse.findUnique({ where: { id: data.toWarehouseId } }),
      prisma.productVariant.findUnique({ where: { id: data.variantId } }),
    ]);

    if (!fromWarehouse) {
      throw new Error(`Source warehouse with ID "${data.fromWarehouseId}" not found`);
    }

    if (!toWarehouse) {
      throw new Error(`Destination warehouse with ID "${data.toWarehouseId}" not found`);
    }

    if (!variant) {
      throw new Error(`Variant with ID "${data.variantId}" not found`);
    }

    // Validate warehouses are different
    if (data.fromWarehouseId === data.toWarehouseId) {
      throw new Error('Source and destination warehouses must be different');
    }

    // Validate quantity is positive
    if (data.quantity <= 0) {
      throw new Error('Transfer quantity must be greater than zero');
    }

    // Check if source warehouse has sufficient inventory
    const sourceInventory = await prisma.warehouseInventory.findUnique({
      where: {
        warehouseId_variantId: {
          warehouseId: data.fromWarehouseId,
          variantId: data.variantId,
        },
      },
    });

    if (!sourceInventory || sourceInventory.available < data.quantity) {
      throw new Error(
        `Insufficient available inventory in source warehouse. Available: ${sourceInventory?.available || 0}, Required: ${data.quantity}`
      );
    }

    // Create transfer record
    const transfer = await prisma.inventoryTransfer.create({
      data: {
        fromWarehouseId: data.fromWarehouseId,
        toWarehouseId: data.toWarehouseId,
        variantId: data.variantId,
        quantity: data.quantity,
        status: 'PENDING',
        reason: data.reason,
        notes: data.notes,
        userId: data.userId,
        referenceId: data.referenceId,
        metadata: data.metadata ?? undefined,
      },
      include: {
        fromWarehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        toWarehouse: {
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
              },
            },
          },
        },
      },
    });

    // Invalidate cache
    await this.incrementInventoryVersion();

    return transfer;
  }

  /**
   * Update inventory transfer status
   */
  static async updateInventoryTransfer(
    transferId: string,
    data: UpdateInventoryTransferRequest
  ) {
    // Validate transfer exists
    const transfer = await prisma.inventoryTransfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer) {
      throw new Error(`Transfer with ID "${transferId}" not found`);
    }

    // Validate status transition
    if (transfer.status === 'COMPLETED') {
      throw new Error('Cannot update a completed transfer');
    }

    if (transfer.status === 'CANCELLED') {
      throw new Error('Cannot update a cancelled transfer');
    }

    // Update transfer
    const updated = await prisma.inventoryTransfer.update({
      where: { id: transferId },
      data: {
        status: data.status,
        notes: data.notes ? `${transfer.notes ? transfer.notes + '\n' : ''}${data.notes}` : transfer.notes,
      },
      include: {
        fromWarehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        toWarehouse: {
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
              },
            },
          },
        },
      },
    });

    // Invalidate cache
    await this.incrementInventoryVersion();

    return updated;
  }

  /**
   * Complete an inventory transfer (moves inventory between warehouses)
   */
  static async completeInventoryTransfer(
    transferId: string,
    data?: ApproveInventoryTransferRequest
  ) {
    // Validate transfer exists
    const transfer = await prisma.inventoryTransfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer) {
      throw new Error(`Transfer with ID "${transferId}" not found`);
    }

    // Validate status
    if (transfer.status === 'COMPLETED') {
      throw new Error('Transfer is already completed');
    }

    if (transfer.status === 'CANCELLED') {
      throw new Error('Cannot complete a cancelled transfer');
    }

    // Use transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get source inventory
      const sourceInventory = await tx.warehouseInventory.findUnique({
        where: {
          warehouseId_variantId: {
            warehouseId: transfer.fromWarehouseId,
            variantId: transfer.variantId,
          },
        },
      });

      if (!sourceInventory || sourceInventory.available < transfer.quantity) {
        throw new Error(
          `Insufficient available inventory in source warehouse. Available: ${sourceInventory?.available || 0}, Required: ${transfer.quantity}`
        );
      }

      // Decrease source warehouse inventory
      const newSourceQuantity = sourceInventory.quantity - transfer.quantity;
      const newSourceAvailable = Math.max(0, newSourceQuantity - sourceInventory.reserved);

      await tx.warehouseInventory.update({
        where: { id: sourceInventory.id },
        data: {
          quantity: newSourceQuantity,
          available: newSourceAvailable,
        },
      });

      // Get or create destination inventory
      let destInventory = await tx.warehouseInventory.findUnique({
        where: {
          warehouseId_variantId: {
            warehouseId: transfer.toWarehouseId,
            variantId: transfer.variantId,
          },
        },
      });

      if (!destInventory) {
        // Create new inventory record
        destInventory = await tx.warehouseInventory.create({
          data: {
            warehouseId: transfer.toWarehouseId,
            variantId: transfer.variantId,
            quantity: transfer.quantity,
            reserved: 0,
            available: transfer.quantity,
            lowStock: 10, // Default threshold
          },
        });
      } else {
        // Update existing inventory
        const newDestQuantity = destInventory.quantity + transfer.quantity;
        const newDestAvailable = newDestQuantity - destInventory.reserved;

        await tx.warehouseInventory.update({
          where: { id: destInventory.id },
          data: {
            quantity: newDestQuantity,
            available: newDestAvailable,
          },
        });
      }

      // Create adjustment records for audit trail
      await tx.inventoryAdjustment.createMany({
        data: [
          // Source warehouse adjustment (negative)
          {
            warehouseId: transfer.fromWarehouseId,
            variantId: transfer.variantId,
            type: 'manual',
            quantity: -transfer.quantity,
            reason: `Transfer to ${transfer.toWarehouseId}`,
            notes: data?.notes,
            userId: transfer.userId,
            referenceId: transfer.id,
            metadata: { transferId: transfer.id, type: 'transfer_out' },
          },
          // Destination warehouse adjustment (positive)
          {
            warehouseId: transfer.toWarehouseId,
            variantId: transfer.variantId,
            type: 'manual',
            quantity: transfer.quantity,
            reason: `Transfer from ${transfer.fromWarehouseId}`,
            notes: data?.notes,
            userId: transfer.userId,
            referenceId: transfer.id,
            metadata: { transferId: transfer.id, type: 'transfer_in' },
          },
        ],
      });

      // Update transfer status
      const updatedTransfer = await tx.inventoryTransfer.update({
        where: { id: transferId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          notes: data?.notes ? `${transfer.notes ? transfer.notes + '\n' : ''}${data.notes}` : transfer.notes,
        },
        include: {
          fromWarehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          toWarehouse: {
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
                },
              },
            },
          },
        },
      });

      return updatedTransfer;
    });

    // Invalidate cache
    await this.incrementInventoryVersion();

    return result;
  }

  /**
   * Cancel an inventory transfer
   */
  static async cancelInventoryTransfer(
    transferId: string,
    data: CancelInventoryTransferRequest
  ) {
    // Validate transfer exists
    const transfer = await prisma.inventoryTransfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer) {
      throw new Error(`Transfer with ID "${transferId}" not found`);
    }

    // Validate status
    if (transfer.status === 'COMPLETED') {
      throw new Error('Cannot cancel a completed transfer');
    }

    if (transfer.status === 'CANCELLED') {
      throw new Error('Transfer is already cancelled');
    }

    // Update transfer
    const updated = await prisma.inventoryTransfer.update({
      where: { id: transferId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        reason: data.reason,
        notes: data.notes ? `${transfer.notes ? transfer.notes + '\n' : ''}${data.notes}` : transfer.notes,
      },
      include: {
        fromWarehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        toWarehouse: {
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
              },
            },
          },
        },
      },
    });

    // Invalidate cache
    await this.incrementInventoryVersion();

    return updated;
  }

  /**
   * Get inventory transfer by ID
   */
  static async getInventoryTransferById(transferId: string): Promise<InventoryTransferWithDetails> {
    // Check cache
    const version = await this.getInventoryVersion();
    const cacheKey = `${this.CACHE_PREFIX}v${version}:transfer:${transferId}`;
    const cached = await CacheService.get<InventoryTransferWithDetails>(cacheKey);
    if (cached) {
      return cached;
    }

    const transfer = await prisma.inventoryTransfer.findUnique({
      where: { id: transferId },
      include: {
        fromWarehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        toWarehouse: {
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
              },
            },
          },
        },
      },
    });

    if (!transfer) {
      throw new Error(`Transfer with ID "${transferId}" not found`);
    }

    // Transform to match interface
    const result: InventoryTransferWithDetails = {
      id: transfer.id,
      fromWarehouseId: transfer.fromWarehouseId,
      toWarehouseId: transfer.toWarehouseId,
      variantId: transfer.variantId,
      quantity: transfer.quantity,
      status: transfer.status as any,
      reason: transfer.reason || undefined,
      notes: transfer.notes || undefined,
      userId: transfer.userId || undefined,
      referenceId: transfer.referenceId || undefined,
      metadata: parseJsonValue(transfer.metadata),
      completedAt: transfer.completedAt?.toISOString(),
      cancelledAt: transfer.cancelledAt?.toISOString(),
      createdAt: transfer.createdAt.toISOString(),
      updatedAt: transfer.updatedAt.toISOString(),
      fromWarehouse: transfer.fromWarehouse
        ? {
            id: transfer.fromWarehouse.id,
            name: transfer.fromWarehouse.name,
            code: transfer.fromWarehouse.code,
          }
        : undefined,
      toWarehouse: transfer.toWarehouse
        ? {
            id: transfer.toWarehouse.id,
            name: transfer.toWarehouse.name,
            code: transfer.toWarehouse.code,
          }
        : undefined,
      variant: transfer.variant
        ? {
            id: transfer.variant.id,
            name: transfer.variant.name,
            skuCode: transfer.variant.skuCode || undefined,
          }
        : undefined,
      product: transfer.variant?.product
        ? {
            id: transfer.variant.product.id,
            name: transfer.variant.product.name,
          }
        : undefined,
    };

    // Cache result
    await CacheService.set(cacheKey, result, { ttl: this.CACHE_TTL });

    return result;
  }

  /**
   * Normalize transfer filters for stable cache keys
   */
  private static normalizeTransferFilters(filters: InventoryTransferFilters) {
    const validFilters: Record<string, any> = {};

    if (filters.fromWarehouseId) validFilters.fromWarehouseId = filters.fromWarehouseId;
    if (filters.toWarehouseId) validFilters.toWarehouseId = filters.toWarehouseId;
    if (filters.variantId) validFilters.variantId = filters.variantId;
    if (filters.productId) validFilters.productId = filters.productId;
    if (filters.status) validFilters.status = filters.status;
    if (filters.userId) validFilters.userId = filters.userId;
    if (filters.startDate) validFilters.startDate = filters.startDate;
    if (filters.endDate) validFilters.endDate = filters.endDate;

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
   * Get inventory transfers with pagination and filtering
   */
  static async getInventoryTransfers(
    page = 1,
    limit = 20,
    filters: InventoryTransferFilters = {}
  ): Promise<InventoryTransferResult> {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (filters.fromWarehouseId) {
      where.fromWarehouseId = filters.fromWarehouseId;
    }

    if (filters.toWarehouseId) {
      where.toWarehouseId = filters.toWarehouseId;
    }

    if (filters.variantId) {
      where.variantId = filters.variantId;
    }

    if (filters.productId) {
      where.variant = {
        productId: filters.productId,
      };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    // Build orderBy
    const orderBy: any = {};
    if (filters.sortBy && ['quantity', 'status', 'createdAt', 'completedAt'].includes(filters.sortBy)) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    // Check cache
    const version = await this.getInventoryVersion();
    const normalizedFilters = this.normalizeTransferFilters(filters);
    const filterHash = Buffer.from(JSON.stringify(normalizedFilters)).toString('base64');
    const cacheKey = `${this.CACHE_PREFIX}v${version}:transfers:${page}:${limit}:${filterHash}`;
    const cached = await CacheService.get<InventoryTransferResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch data
    const [transfers, total] = await Promise.all([
      prisma.inventoryTransfer.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          fromWarehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          toWarehouse: {
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
                },
              },
            },
          },
        },
      }),
      prisma.inventoryTransfer.count({ where }),
    ]);

    // Transform to match interface
    const items = transfers.map((transfer) => ({
      id: transfer.id,
      fromWarehouseId: transfer.fromWarehouseId,
      toWarehouseId: transfer.toWarehouseId,
      variantId: transfer.variantId,
      quantity: transfer.quantity,
      status: transfer.status as any,
      reason: transfer.reason || undefined,
      notes: transfer.notes || undefined,
      userId: transfer.userId || undefined,
      referenceId: transfer.referenceId || undefined,
      metadata: parseJsonValue(transfer.metadata),
      completedAt: transfer.completedAt?.toISOString(),
      cancelledAt: transfer.cancelledAt?.toISOString(),
      createdAt: transfer.createdAt.toISOString(),
      updatedAt: transfer.updatedAt.toISOString(),
      fromWarehouse: transfer.fromWarehouse
        ? {
            id: transfer.fromWarehouse.id,
            name: transfer.fromWarehouse.name,
            code: transfer.fromWarehouse.code,
          }
        : undefined,
      toWarehouse: transfer.toWarehouse
        ? {
            id: transfer.toWarehouse.id,
            name: transfer.toWarehouse.name,
            code: transfer.toWarehouse.code,
          }
        : undefined,
      variant: transfer.variant
        ? {
            id: transfer.variant.id,
            name: transfer.variant.name,
            skuCode: transfer.variant.skuCode || undefined,
          }
        : undefined,
      product: transfer.variant?.product
        ? {
            id: transfer.variant.product.id,
            name: transfer.variant.product.name,
          }
        : undefined,
    }));

    const result: InventoryTransferResult = {
      items,
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
   * Export inventory to CSV format
   *
   * Exports all warehouse inventory with product and variant details in CSV format.
   * Suitable for bulk editing and reimporting.
   *
   * @param warehouseId - Optional warehouse filter, if not provided exports all warehouses
   * @returns CSV string with inventory data
   */
  static async exportInventoryCSV(warehouseId?: string): Promise<string> {
    // Build query
    const where: any = {};
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    // Fetch all inventory with relations
    const inventories = await prisma.warehouseInventory.findMany({
      where,
      include: {
        warehouse: {
          select: {
            code: true,
            name: true,
          },
        },
        variant: {
          select: {
            skuCode: true,
            name: true,
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { warehouse: { code: 'asc' } },
        { variant: { skuCode: 'asc' } },
      ],
    });

    // Generate CSV
    const headers = [
      'Warehouse Code',
      'Warehouse Name',
      'SKU Code',
      'Variant Name',
      'Product Name',
      'Quantity',
      'Reserved',
      'Available',
      'Low Stock Threshold',
    ];
    const csvLines = [headers.join(',')];

    for (const inv of inventories) {
      const row = [
        inv.warehouse?.code || '',
        `"${(inv.warehouse?.name || '').replace(/"/g, '""')}"`,
        inv.variant?.skuCode || '',
        `"${(inv.variant?.name || '').replace(/"/g, '""')}"`,
        `"${(inv.variant?.product?.name || '').replace(/"/g, '""')}"`,
        inv.quantity.toString(),
        inv.reserved.toString(),
        inv.available.toString(),
        (inv.lowStock ?? '').toString(),
      ];
      csvLines.push(row.join(','));
    }

    return csvLines.join('\n');
  }

  /**
   * Import inventory from CSV format
   *
   * Imports and updates inventory from CSV data. Validates warehouses and variants exist.
   * CSV format: Warehouse Code, SKU Code, Quantity, Low Stock Threshold (optional)
   *
   * @param csvData - CSV string with inventory updates
   * @param userId - User ID performing the import (for audit trail)
   * @returns Import result with success/failure details
   */
  static async importInventoryCSV(
    csvData: string,
    userId?: string
  ): Promise<ImportInventoryResult> {
    const result: ImportInventoryResult = {
      success: false,
      processedRows: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      errors: [],
    };

    try {
      // Parse CSV
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) {
        result.errors.push({
          row: 0,
          field: 'file',
          message: 'CSV file is empty or contains only headers',
        });
        return result;
      }

      // Skip header row
      const dataLines = lines.slice(1);

      // Validate and collect updates
      const updates: BulkInventoryUpdate[] = [];
      const warehouseCodes = new Set<string>();
      const skuCodes = new Set<string>();

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        if (!line) continue;

        result.processedRows++;
        const rowNumber = i + 2; // +2 because we skipped header and arrays are 0-indexed

        // Parse CSV row (handle quoted fields)
        const fields = this.parseCSVLine(line);

        if (fields.length < 3) {
          result.errors.push({
            row: rowNumber,
            field: 'row',
            message: 'Insufficient columns. Expected: Warehouse Code, SKU Code, Quantity, [Low Stock Threshold]',
          });
          result.failedUpdates++;
          continue;
        }

        const [warehouseCode, skuCode, quantityStr, lowStockStr] = fields;

        // Validate required fields
        if (!warehouseCode || !warehouseCode.trim()) {
          result.errors.push({
            row: rowNumber,
            field: 'warehouseCode',
            message: 'Warehouse Code is required',
          });
          result.failedUpdates++;
          continue;
        }

        if (!skuCode || !skuCode.trim()) {
          result.errors.push({
            row: rowNumber,
            field: 'skuCode',
            message: 'SKU Code is required',
          });
          result.failedUpdates++;
          continue;
        }

        // Validate quantity
        const quantity = parseInt(quantityStr, 10);
        if (isNaN(quantity) || quantity < 0) {
          result.errors.push({
            row: rowNumber,
            field: 'quantity',
            message: 'Quantity must be a non-negative integer',
          });
          result.failedUpdates++;
          continue;
        }

        // Validate low stock threshold (optional)
        let lowStock: number | undefined;
        if (lowStockStr && lowStockStr.trim()) {
          lowStock = parseInt(lowStockStr, 10);
          if (isNaN(lowStock) || lowStock < 0) {
            result.errors.push({
              row: rowNumber,
              field: 'lowStock',
              message: 'Low Stock Threshold must be a non-negative integer',
            });
            result.failedUpdates++;
            continue;
          }
        }

        warehouseCodes.add(warehouseCode.trim());
        skuCodes.add(skuCode.trim());

        updates.push({
          warehouseId: '', // Will be resolved below
          variantId: '', // Will be resolved below
          quantity,
          lowStock,
        });
      }

      if (updates.length === 0) {
        result.errors.push({
          row: 0,
          field: 'file',
          message: 'No valid rows to import',
        });
        return result;
      }

      // Fetch warehouses and variants in bulk
      const [warehouses, variants] = await Promise.all([
        prisma.warehouse.findMany({
          where: { code: { in: Array.from(warehouseCodes) } },
          select: { id: true, code: true },
        }),
        prisma.productVariant.findMany({
          where: { skuCode: { in: Array.from(skuCodes) } },
          select: { id: true, skuCode: true },
        }),
      ]);

      const warehouseMap = new Map(warehouses.map((w) => [w.code, w.id]));
      const variantMap = new Map(variants.map((v) => [v.skuCode!, v.id]));

      // Process updates in a transaction
      let successCount = 0;
      const dataLines2 = dataLines.filter((line) => line.trim());

      for (let i = 0; i < updates.length; i++) {
        const rowNumber = i + 2;
        const line = dataLines2[i];
        const fields = this.parseCSVLine(line);
        const [warehouseCode, skuCode] = fields;

        const warehouseId = warehouseMap.get(warehouseCode.trim());
        const variantId = variantMap.get(skuCode.trim());

        if (!warehouseId) {
          result.errors.push({
            row: rowNumber,
            field: 'warehouseCode',
            message: `Warehouse with code '${warehouseCode}' not found`,
          });
          result.failedUpdates++;
          continue;
        }

        if (!variantId) {
          result.errors.push({
            row: rowNumber,
            field: 'skuCode',
            message: `Variant with SKU '${skuCode}' not found`,
          });
          result.failedUpdates++;
          continue;
        }

        updates[i].warehouseId = warehouseId;
        updates[i].variantId = variantId;

        try {
          // Update or create inventory record
          await prisma.$transaction(async (tx) => {
            const existing = await tx.warehouseInventory.findUnique({
              where: {
                warehouseId_variantId: {
                  warehouseId,
                  variantId,
                },
              },
            });

            const newQuantity = updates[i].quantity;
            const reserved = existing?.reserved || 0;
            const available = Math.max(0, newQuantity - reserved);

            const data: any = {
              quantity: newQuantity,
              available,
            };

            if (updates[i].lowStock !== undefined) {
              data.lowStock = updates[i].lowStock;
            }

            if (existing) {
              // Update existing record
              await tx.warehouseInventory.update({
                where: {
                  warehouseId_variantId: {
                    warehouseId,
                    variantId,
                  },
                },
                data,
              });

              // Create adjustment record for audit trail
              const quantityChange = newQuantity - existing.quantity;
              if (quantityChange !== 0) {
                await tx.inventoryAdjustment.create({
                  data: {
                    warehouseId,
                    variantId,
                    type: 'manual',
                    quantity: quantityChange,
                    reason: 'CSV bulk import',
                    userId,
                  },
                });
              }
            } else {
              // Create new record
              await tx.warehouseInventory.create({
                data: {
                  warehouseId,
                  variantId,
                  ...data,
                },
              });

              // Create adjustment record for initial stock
              await tx.inventoryAdjustment.create({
                data: {
                  warehouseId,
                  variantId,
                  type: 'initial',
                  quantity: newQuantity,
                  reason: 'CSV bulk import - initial stock',
                  userId,
                },
              });
            }

          });

          successCount++;
          result.successfulUpdates++;
        } catch (error: any) {
          result.errors.push({
            row: rowNumber,
            field: 'update',
            message: error.message || 'Failed to update inventory',
          });
          result.failedUpdates++;
        }
      }

      // Invalidate cache on successful updates
      if (successCount > 0) {
        await this.incrementInventoryVersion();
      }

      result.success = result.successfulUpdates > 0;
      return result;
    } catch (error: any) {
      result.errors.push({
        row: 0,
        field: 'import',
        message: error.message || 'Unexpected error during import',
      });
      return result;
    }
  }

  /**
   * Parse a single CSV line, handling quoted fields
   *
   * @param line - CSV line to parse
   * @returns Array of field values
   */
  private static parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        // Field separator
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }

    // Add last field
    fields.push(currentField.trim());

    return fields;
  }
}

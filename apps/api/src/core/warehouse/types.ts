/**
 * Warehouse Service Types
 *
 * Internal types for warehouse service operations.
 */

import { Warehouse } from '@prisma/client';

export interface WarehouseListResult {
  warehouses: Warehouse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface WarehouseWithStats extends Warehouse {
  inventoryCount: number;
  totalQuantity: number;
  lowStockCount: number;
}

export interface WarehouseStats {
  totalWarehouses: number;
  activeWarehouses: number;
  totalInventory: number;
  totalQuantity: number;
  lowStockItems: number;
  outOfStockItems: number;
  warehouseBreakdown: Array<{
    warehouseId: string;
    warehouseName: string;
    totalItems: number;
    totalQuantity: number;
    lowStockCount: number;
  }>;
}

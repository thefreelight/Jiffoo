import type {
  WarehouseInventory,
  InventoryAdjustmentDetail,
  InventoryTransfer,
  InventoryTransferDetail,
} from '@jiffoo/shared';

/**
 * Result type for paginated inventory lists
 */
export interface InventoryListResult {
  items: WarehouseInventory[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Extended warehouse inventory with product and variant details
 */
export interface InventoryWithDetails extends WarehouseInventory {
  warehouse?: {
    id: string;
    name: string;
    code: string;
  };
  variant?: {
    id: string;
    name: string;
    skuCode?: string;
  };
  product?: {
    id: string;
    name: string;
  };
}

/**
 * Result type for paginated inventory adjustment history
 */
export interface InventoryHistoryResult {
  items: InventoryAdjustmentDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Available stock calculation result
 */
export interface AvailableStockResult {
  variantId: string;
  totalQuantity: number;
  totalReserved: number;
  totalAvailable: number;
  warehouseBreakdown: Array<{
    warehouseId: string;
    warehouseName: string;
    quantity: number;
    reserved: number;
    available: number;
  }>;
}

/**
 * Result type for paginated inventory transfers
 */
export interface InventoryTransferResult {
  items: InventoryTransferDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Extended inventory transfer with warehouse and variant details
 */
export interface InventoryTransferWithDetails extends InventoryTransfer {
  fromWarehouse?: {
    id: string;
    name: string;
    code: string;
  };
  toWarehouse?: {
    id: string;
    name: string;
    code: string;
  };
  variant?: {
    id: string;
    name: string;
    skuCode?: string;
  };
  product?: {
    id: string;
    name: string;
  };
}

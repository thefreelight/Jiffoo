export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address?: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseInventory {
  id: string;
  warehouseId: string;
  variantId: string;
  quantity: number;
  reserved: number;
  available: number;
  lowStock: number;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseWithInventory extends Warehouse {
  inventoryCount?: number;
  totalQuantity?: number;
  lowStockCount?: number;
}

export interface WarehouseInventoryDetail extends WarehouseInventory {
  warehouse?: Warehouse;
  variantName?: string;
  productName?: string;
  sku?: string;
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

export interface WarehouseFilters {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'code' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface WarehouseInventoryFilters {
  page?: number;
  limit?: number;
  warehouseId?: string;
  variantId?: string;
  productId?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
  sortBy?: 'quantity' | 'available' | 'reserved' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateWarehouseRequest {
  name: string;
  code: string;
  address?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface UpdateWarehouseRequest {
  name?: string;
  code?: string;
  address?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface SetDefaultWarehouseRequest {
  warehouseId: string;
}

export interface BulkInventoryUpdate {
  warehouseId: string;
  variantId: string;
  quantity: number;
  lowStock?: number;
}

export interface ImportInventoryResult {
  success: boolean;
  processedRows: number;
  successfulUpdates: number;
  failedUpdates: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
}

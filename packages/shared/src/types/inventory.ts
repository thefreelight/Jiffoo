export interface InventoryAdjustment {
  id: string;
  warehouseId: string;
  variantId: string;
  type: InventoryAdjustmentType;
  quantity: number;
  reason?: string;
  notes?: string;
  userId?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type InventoryAdjustmentType =
  | 'manual'
  | 'damage'
  | 'return'
  | 'recount'
  | 'initial'
  | 'correction';

export interface InventoryTransfer {
  id: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  variantId: string;
  quantity: number;
  status: InventoryTransferStatus;
  reason?: string;
  notes?: string;
  userId?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
  completedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type InventoryTransferStatus =
  | 'PENDING'
  | 'IN_TRANSIT'
  | 'COMPLETED'
  | 'CANCELLED';

export interface InventoryAdjustmentDetail extends InventoryAdjustment {
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
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export interface InventoryTransferDetail extends InventoryTransfer {
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
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export interface InventoryStats {
  totalInventoryValue: number;
  totalProducts: number;
  totalVariants: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalQuantity: number;
  totalReserved: number;
  totalAvailable: number;
  warehouseStats: Array<{
    warehouseId: string;
    warehouseName: string;
    warehouseCode: string;
    totalQuantity: number;
    totalReserved: number;
    totalAvailable: number;
    lowStockItems: number;
    outOfStockItems: number;
  }>;
  topLowStockProducts: Array<{
    variantId: string;
    variantName: string;
    productId: string;
    productName: string;
    warehouseId: string;
    warehouseName: string;
    quantity: number;
    available: number;
    lowStock: number;
  }>;
}

export interface InventoryAdjustmentFilters {
  page?: number;
  limit?: number;
  warehouseId?: string;
  variantId?: string;
  productId?: string;
  type?: InventoryAdjustmentType;
  userId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'quantity' | 'type';
  sortOrder?: 'asc' | 'desc';
}

export interface InventoryTransferFilters {
  page?: number;
  limit?: number;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  variantId?: string;
  productId?: string;
  status?: InventoryTransferStatus;
  userId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'quantity' | 'status' | 'completedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateInventoryAdjustmentRequest {
  warehouseId: string;
  variantId: string;
  type: InventoryAdjustmentType;
  quantity: number;
  reason?: string;
  notes?: string;
  userId?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateInventoryTransferRequest {
  fromWarehouseId: string;
  toWarehouseId: string;
  variantId: string;
  quantity: number;
  reason?: string;
  notes?: string;
  userId?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateInventoryTransferRequest {
  status: InventoryTransferStatus;
  notes?: string;
}

export interface ApproveInventoryTransferRequest {
  notes?: string;
}

export interface CancelInventoryTransferRequest {
  reason?: string;
  notes?: string;
}

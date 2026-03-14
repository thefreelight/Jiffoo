/**
 * Inventory Management API Client
 * Provides API methods for warehouses, inventory, transfers, and stock alerts
 */

import { apiClient } from '../api';
import type { ApiResponse, PageResult, ListResult } from 'shared';
import type {
  // Warehouse Types
  Warehouse,
  WarehouseInventory,
  WarehouseWithInventory,
  WarehouseStats,
  WarehouseFilters,
  WarehouseInventoryFilters,
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
  SetDefaultWarehouseRequest,
  ImportInventoryResult,

  // Inventory Types
  InventoryAdjustment,
  InventoryTransfer,
  InventoryAdjustmentDetail,
  InventoryTransferDetail,
  InventoryAdjustmentFilters,
  InventoryTransferFilters,
  CreateInventoryAdjustmentRequest,
  CreateInventoryTransferRequest,
  UpdateInventoryTransferRequest,
  ApproveInventoryTransferRequest,
  CancelInventoryTransferRequest,

  // Stock Alert Types
  StockAlert,
  StockAlertDetail,
  StockAlertStats,
  StockAlertFilters,
  CreateStockAlertRequest,
  UpdateStockAlertRequest,
  ResolveStockAlertRequest,
  BulkResolveStockAlertsRequest,
} from 'shared';

// ============================================================================
// Warehouse API
// ============================================================================

export const warehouseApi = {
  /**
   * Get list of warehouses with pagination and filtering
   */
  getAll: (params: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    sortBy?: 'name' | 'code' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<ApiResponse<PageResult<Warehouse>>> =>
    apiClient.get('/admin/warehouses', { params }),

  /**
   * Get warehouse by ID
   */
  getById: (id: string): Promise<ApiResponse<Warehouse>> =>
    apiClient.get(`/admin/warehouses/${id}`),

  /**
   * Get warehouse with inventory statistics
   */
  getWithStats: (id: string): Promise<ApiResponse<WarehouseWithInventory>> =>
    apiClient.get(`/admin/warehouses/${id}/stats`),

  /**
   * Get warehouse statistics across all warehouses
   */
  getStats: (): Promise<ApiResponse<WarehouseStats>> =>
    apiClient.get('/admin/warehouses/stats'),

  /**
   * Get default warehouse
   */
  getDefault: (): Promise<ApiResponse<Warehouse>> =>
    apiClient.get('/admin/warehouses/default'),

  /**
   * Create new warehouse
   */
  create: (data: CreateWarehouseRequest): Promise<ApiResponse<Warehouse>> =>
    apiClient.post('/admin/warehouses', data),

  /**
   * Update warehouse
   */
  update: (id: string, data: UpdateWarehouseRequest): Promise<ApiResponse<Warehouse>> =>
    apiClient.put(`/admin/warehouses/${id}`, data),

  /**
   * Set warehouse as default
   */
  setDefault: (id: string): Promise<ApiResponse<Warehouse>> =>
    apiClient.put(`/admin/warehouses/${id}/default`),

  /**
   * Delete warehouse
   */
  delete: (id: string): Promise<ApiResponse<void>> =>
    apiClient.delete(`/admin/warehouses/${id}`),
};

// ============================================================================
// Inventory API
// ============================================================================

export const inventoryApi = {
  /**
   * Get inventory for a specific variant across all warehouses
   */
  getByVariant: (
    variantId: string,
    includeInactive?: boolean
  ): Promise<ApiResponse<WarehouseInventory[]>> =>
    apiClient.get(`/admin/inventory/variants/${variantId}`, {
      params: { includeInactive },
    }),

  /**
   * Get inventory for a specific warehouse with pagination and filtering
   */
  getByWarehouse: (
    warehouseId: string,
    params: {
      page?: number;
      limit?: number;
      variantId?: string;
      productId?: string;
      lowStock?: boolean;
      outOfStock?: boolean;
      sortBy?: 'quantity' | 'available' | 'reserved' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<ApiResponse<PageResult<WarehouseInventory>>> =>
    apiClient.get(`/admin/inventory/warehouses/${warehouseId}`, { params }),

  /**
   * Adjust inventory (add/remove stock)
   */
  adjust: (data: CreateInventoryAdjustmentRequest): Promise<ApiResponse<WarehouseInventory>> =>
    apiClient.post('/admin/inventory/adjustments', data),

  /**
   * Get inventory adjustment history with pagination and filtering
   */
  getAdjustments: (params: {
    page?: number;
    limit?: number;
    warehouseId?: string;
    variantId?: string;
    productId?: string;
    type?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: 'type' | 'quantity' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<ApiResponse<PageResult<InventoryAdjustmentDetail>>> =>
    apiClient.get('/admin/inventory/adjustments', { params }),

  /**
   * Calculate available stock for a variant across all warehouses
   */
  getAvailableStock: (variantId: string): Promise<ApiResponse<{
    variantId: string;
    totalQuantity: number;
    totalReserved: number;
    totalAvailable: number;
    warehouses: Array<{
      warehouseId: string;
      warehouseName: string;
      quantity: number;
      reserved: number;
      available: number;
    }>;
  }>> =>
    apiClient.get(`/admin/inventory/stock/${variantId}`),

  /**
   * Export inventory to CSV
   */
  exportCSV: (warehouseId?: string): Promise<ApiResponse<string>> =>
    apiClient.get('/admin/inventory/export', {
      params: { warehouseId },
    }),

  /**
   * Import inventory from CSV
   */
  importCSV: (csvData: string, userId?: string): Promise<ApiResponse<ImportInventoryResult>> =>
    apiClient.post('/admin/inventory/import', { csvData, userId }),
};

// ============================================================================
// Inventory Transfer API
// ============================================================================

export const inventoryTransferApi = {
  /**
   * Create inventory transfer between warehouses
   */
  create: (data: CreateInventoryTransferRequest): Promise<ApiResponse<InventoryTransferDetail>> =>
    apiClient.post('/admin/inventory/transfers', data),

  /**
   * Get list of inventory transfers with pagination and filtering
   */
  getAll: (params: {
    page?: number;
    limit?: number;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    variantId?: string;
    productId?: string;
    status?: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
    userId?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: 'quantity' | 'status' | 'createdAt' | 'completedAt';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<ApiResponse<PageResult<InventoryTransferDetail>>> =>
    apiClient.get('/admin/inventory/transfers', { params }),

  /**
   * Get inventory transfer by ID
   */
  getById: (id: string): Promise<ApiResponse<InventoryTransferDetail>> =>
    apiClient.get(`/admin/inventory/transfers/${id}`),

  /**
   * Update inventory transfer status and notes
   */
  update: (id: string, data: UpdateInventoryTransferRequest): Promise<ApiResponse<InventoryTransferDetail>> =>
    apiClient.put(`/admin/inventory/transfers/${id}`, data),

  /**
   * Complete inventory transfer (moves inventory)
   */
  complete: (id: string, notes?: string): Promise<ApiResponse<InventoryTransferDetail>> =>
    apiClient.post(`/admin/inventory/transfers/${id}/complete`, { notes }),

  /**
   * Cancel inventory transfer
   */
  cancel: (id: string, data: CancelInventoryTransferRequest): Promise<ApiResponse<InventoryTransferDetail>> =>
    apiClient.post(`/admin/inventory/transfers/${id}/cancel`, data),
};

// ============================================================================
// Stock Alert API
// ============================================================================

export const stockAlertApi = {
  /**
   * Get list of stock alerts with pagination and filtering
   */
  getAll: (params: {
    page?: number;
    limit?: number;
    warehouseId?: string;
    variantId?: string;
    productId?: string;
    alertType?: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'RESTOCK_NEEDED';
    status?: 'ACTIVE' | 'RESOLVED' | 'DISMISSED';
    dateFrom?: string;
    dateTo?: string;
    sortBy?: 'createdAt' | 'updatedAt' | 'threshold' | 'quantity';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<ApiResponse<PageResult<StockAlertDetail>>> =>
    apiClient.get('/admin/stock-alerts', { params }),

  /**
   * Get stock alert by ID
   */
  getById: (id: string): Promise<ApiResponse<StockAlertDetail>> =>
    apiClient.get(`/admin/stock-alerts/${id}`),

  /**
   * Get stock alert statistics
   */
  getStats: (): Promise<ApiResponse<StockAlertStats>> =>
    apiClient.get('/admin/stock-alerts/stats/summary'),

  /**
   * Create new stock alert
   */
  create: (data: CreateStockAlertRequest): Promise<ApiResponse<StockAlert>> =>
    apiClient.post('/admin/stock-alerts', data),

  /**
   * Update stock alert
   */
  update: (id: string, data: UpdateStockAlertRequest): Promise<ApiResponse<StockAlert>> =>
    apiClient.put(`/admin/stock-alerts/${id}`, data),

  /**
   * Resolve or dismiss stock alert
   */
  resolve: (id: string, data: ResolveStockAlertRequest): Promise<ApiResponse<StockAlert>> =>
    apiClient.post(`/admin/stock-alerts/${id}/resolve`, data),

  /**
   * Bulk resolve or dismiss stock alerts
   */
  bulkResolve: (data: BulkResolveStockAlertsRequest): Promise<ApiResponse<{ count: number }>> =>
    apiClient.post('/admin/stock-alerts/bulk-resolve', data),

  /**
   * Delete stock alert
   */
  delete: (id: string): Promise<ApiResponse<void>> =>
    apiClient.delete(`/admin/stock-alerts/${id}`),

  /**
   * Manually trigger stock alert check
   */
  triggerCheck: (): Promise<ApiResponse<void>> =>
    apiClient.post('/admin/stock-alerts/check'),
};

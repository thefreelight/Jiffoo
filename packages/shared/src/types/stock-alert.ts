export interface StockAlert {
  id: string;
  warehouseId: string;
  variantId: string;
  alertType: StockAlertType;
  threshold: number;
  quantity: number;
  status: StockAlertStatus;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type StockAlertType = 'LOW_STOCK' | 'OUT_OF_STOCK' | 'RESTOCK_NEEDED';

export type StockAlertStatus = 'ACTIVE' | 'RESOLVED' | 'DISMISSED';

export interface StockAlertDetail extends StockAlert {
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
    sku: string;
  };
}

export interface StockAlertStats {
  totalAlerts: number;
  activeAlerts: number;
  resolvedAlerts: number;
  dismissedAlerts: number;
  alertsByType: Array<{
    alertType: StockAlertType;
    count: number;
  }>;
  alertsByWarehouse: Array<{
    warehouseId: string;
    warehouseName: string;
    activeCount: number;
  }>;
  recentAlerts: StockAlertDetail[];
}

export interface StockAlertFilters {
  page?: number;
  limit?: number;
  warehouseId?: string;
  variantId?: string;
  productId?: string;
  alertType?: StockAlertType;
  status?: StockAlertStatus;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'threshold' | 'quantity';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateStockAlertRequest {
  warehouseId: string;
  variantId: string;
  alertType: StockAlertType;
  threshold: number;
}

export interface UpdateStockAlertRequest {
  alertType?: StockAlertType;
  threshold?: number;
  status?: StockAlertStatus;
}

export interface ResolveStockAlertRequest {
  alertId: string;
  status: 'RESOLVED' | 'DISMISSED';
}

export interface BulkResolveStockAlertsRequest {
  alertIds: string[];
  status: 'RESOLVED' | 'DISMISSED';
}

// 库存状态
export enum InventoryStatus {
  IN_STOCK = 'IN_STOCK',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  DISCONTINUED = 'DISCONTINUED'
}

// 库存操作类型
export enum InventoryOperation {
  RESTOCK = 'RESTOCK',           // 补货
  SALE = 'SALE',                 // 销售
  RETURN = 'RETURN',             // 退货
  ADJUSTMENT = 'ADJUSTMENT',     // 调整
  DAMAGE = 'DAMAGE',             // 损坏
  TRANSFER = 'TRANSFER',         // 转移
  RESERVE = 'RESERVE',           // 预留
  RELEASE = 'RELEASE'            // 释放预留
}

// 库存警告类型
export enum AlertType {
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  OVERSTOCK = 'OVERSTOCK',
  EXPIRING_SOON = 'EXPIRING_SOON',
  SLOW_MOVING = 'SLOW_MOVING'
}

// 库存记录接口
export interface InventoryRecord {
  id: string;
  productId: string;
  operation: InventoryOperation;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  reference?: string; // 订单ID、退货ID等
  operatorId: string;
  createdAt: Date;
  updatedAt: Date;
}

// 库存警告接口
export interface InventoryAlert {
  id: string;
  productId: string;
  alertType: AlertType;
  threshold: number;
  currentStock: number;
  message: string;
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 库存配置接口
export interface InventoryConfig {
  id: string;
  productId: string;
  minStock: number;        // 最小库存
  maxStock: number;        // 最大库存
  reorderPoint: number;    // 再订货点
  reorderQuantity: number; // 再订货数量
  leadTime: number;        // 交货时间（天）
  autoReorder: boolean;    // 自动补货
  createdAt: Date;
  updatedAt: Date;
}

// 库存统计接口
export interface InventoryStats {
  totalProducts: number;
  inStockProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalValue: number;
  averageStockLevel: number;
  turnoverRate: number;
  alerts: {
    total: number;
    unresolved: number;
    byType: Record<AlertType, number>;
  };
}

// 库存移动接口
export interface InventoryMovement {
  productId: string;
  operation: InventoryOperation;
  quantity: number;
  reason?: string;
  reference?: string;
  operatorId: string;
}

// 批量库存操作接口
export interface BulkInventoryOperation {
  operations: InventoryMovement[];
  reason: string;
  operatorId: string;
}

// 库存预留接口
export interface InventoryReservation {
  id: string;
  productId: string;
  quantity: number;
  orderId?: string;
  customerId?: string;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 库存查询参数
export interface InventoryQuery {
  productId?: string;
  status?: InventoryStatus;
  alertType?: AlertType;
  operation?: InventoryOperation;
  startDate?: Date;
  endDate?: Date;
  operatorId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'quantity' | 'stock';
  sortOrder?: 'asc' | 'desc';
}

// 库存报告接口
export interface InventoryReport {
  period: string;
  summary: {
    totalMovements: number;
    totalQuantityIn: number;
    totalQuantityOut: number;
    netChange: number;
    valueChange: number;
  };
  topMovingProducts: Array<{
    productId: string;
    productName: string;
    totalMovements: number;
    netQuantity: number;
  }>;
  operationBreakdown: Record<InventoryOperation, number>;
  alertsSummary: {
    generated: number;
    resolved: number;
    pending: number;
  };
}

// 库存预测接口
export interface InventoryForecast {
  productId: string;
  currentStock: number;
  predictedDemand: number;
  recommendedReorder: number;
  stockoutRisk: number; // 0-1 之间的风险值
  daysUntilStockout: number;
  confidence: number; // 预测置信度
}

// 库存优化建议
export interface InventoryOptimization {
  productId: string;
  currentConfig: {
    minStock: number;
    maxStock: number;
    reorderPoint: number;
  };
  recommendedConfig: {
    minStock: number;
    maxStock: number;
    reorderPoint: number;
  };
  reasoning: string;
  potentialSavings: number;
  implementationPriority: 'HIGH' | 'MEDIUM' | 'LOW';
}

// 库存同步状态
export interface InventorySyncStatus {
  lastSyncAt: Date;
  isInSync: boolean;
  pendingOperations: number;
  errors: string[];
  nextSyncAt: Date;
}

// 库存审计接口
export interface InventoryAudit {
  id: string;
  productId: string;
  expectedStock: number;
  actualStock: number;
  variance: number;
  auditDate: Date;
  auditorId: string;
  notes?: string;
  adjustmentMade: boolean;
  createdAt: Date;
}

// 库存成本接口
export interface InventoryCost {
  productId: string;
  unitCost: number;
  totalCost: number;
  averageCost: number;
  lastCostUpdate: Date;
  costMethod: 'FIFO' | 'LIFO' | 'AVERAGE';
}

// 库存位置接口（如果有多个仓库）
export interface InventoryLocation {
  id: string;
  name: string;
  address: string;
  type: 'WAREHOUSE' | 'STORE' | 'DISTRIBUTION_CENTER';
  isActive: boolean;
  capacity: number;
  currentUtilization: number;
}

// 库存分配接口
export interface InventoryAllocation {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lastUpdated: Date;
}

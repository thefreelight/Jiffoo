/**
 * Stock Alert Service Types
 *
 * Internal types for the stock alert service
 */

import type {
  StockAlert,
  StockAlertDetail,
  StockAlertStats,
} from '@jiffoo/shared';

/**
 * Stock alert list result with pagination
 */
export interface StockAlertListResult {
  alerts: StockAlertDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Alert check result for a single variant/warehouse combination
 */
export interface AlertCheckResult {
  warehouseId: string;
  variantId: string;
  currentQuantity: number;
  threshold: number;
  alertType: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'RESTOCK_NEEDED';
  shouldAlert: boolean;
  existingAlertId?: string;
}

/**
 * Bulk alert check result
 */
export interface BulkAlertCheckResult {
  totalChecked: number;
  alertsCreated: number;
  alertsResolved: number;
  details: AlertCheckResult[];
}

import { apiClient } from '../api';
import type { ApiResponse, PageResult, CreateInventoryAdjustmentRequest } from 'shared';

export interface InventoryListItem {
  id: string;
  name: string;
  skuCode: string | null;
  stock: number;
  product: { id: string; name: string };
}

export const inventoryApi = {
  list: (params: { page?: number; limit?: number } = {}): Promise<ApiResponse<PageResult<InventoryListItem>>> =>
    apiClient.get('/admin/inventory', { params }),
  set: (variantId: string, quantity: number): Promise<ApiResponse<{ variantId: string; stock: number }>> =>
    apiClient.post('/admin/inventory/set', { variantId, quantity }),
  adjust: (data: CreateInventoryAdjustmentRequest): Promise<ApiResponse<{ id: string; stock: number }>> =>
    apiClient.post('/admin/inventory/adjustments', data),
};

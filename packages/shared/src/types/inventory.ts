export type InventoryAdjustmentType =
  | 'manual'
  | 'damage'
  | 'return'
  | 'recount'
  | 'initial'
  | 'correction';

export interface InventoryAdjustment {
  id: string;
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

export interface CreateInventoryAdjustmentRequest {
  variantId: string;
  type: InventoryAdjustmentType;
  quantity: number;
  reason?: string;
  notes?: string;
  userId?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

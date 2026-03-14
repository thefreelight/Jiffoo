/**
 * Order-related utility types
 *
 * NOTE: The canonical response types live in `./dto/order-dto.ts`.
 * This file only keeps query/filter helpers that are NOT part of backend responses
 * but are used by frontend API clients.
 */

// Re-export status types from the DTO layer so consumers have a single source
export type { OrderStatus, PaymentStatus } from './dto/order-dto';

/**
 * Order list query filters (used by shop frontend)
 */
export interface OrderFilters {
  status?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
  minTotal?: number;
  maxTotal?: number;
}

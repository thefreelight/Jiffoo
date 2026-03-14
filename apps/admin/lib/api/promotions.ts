/**
 * Promotions API Client
 *
 * Re-exports promotions API from the main API client.
 * The actual implementation is in ../api.ts as part of the centralized API structure.
 */

import { promotionsApi, type Promotion, type PromotionForm } from '../api';

// Re-export the promotions API
export { promotionsApi };

// Re-export types for convenience
export type { Promotion, PromotionForm };

// Named exports for convenience
export const {
  getAll: getPromotions,
  getById: getPromotion,
  create: createPromotion,
  update: updatePromotion,
  delete: deletePromotion,
} = promotionsApi;

export default promotionsApi;

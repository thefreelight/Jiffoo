/**
 * Stripe Mock Service
 * 
 * Mock implementation of Stripe SDK for testing.
 */

import { vi } from 'vitest';

// ============================================
// Types
// ============================================

export interface MockCheckoutSession {
  id: string;
  url: string;
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  status: 'open' | 'complete' | 'expired';
  customer: string;
  amount_total: number;
  currency: string;
  metadata: Record<string, string>;
}

export interface MockSubscription {
  id: string;
  customer: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  current_period_start: number;
  current_period_end: number;
  items: { data: Array<{ price: { id: string } }> };
}

// ============================================
// Mock Data Generators
// ============================================

let sessionCounter = 0;
let subscriptionCounter = 0;

export function createMockCheckoutSession(overrides: Partial<MockCheckoutSession> = {}): MockCheckoutSession {
  sessionCounter++;
  return {
    id: `cs_test_${sessionCounter}`,
    url: `https://checkout.stripe.com/test/${sessionCounter}`,
    payment_status: 'unpaid',
    status: 'open',
    customer: 'cus_test_123',
    amount_total: 1000,
    currency: 'usd',
    metadata: {},
    ...overrides,
  };
}

export function createMockSubscription(overrides: Partial<MockSubscription> = {}): MockSubscription {
  subscriptionCounter++;
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `sub_test_${subscriptionCounter}`,
    customer: 'cus_test_123',
    status: 'active',
    current_period_start: now,
    current_period_end: now + 30 * 24 * 60 * 60,
    items: { data: [{ price: { id: 'price_test_123' } }] },
    ...overrides,
  };
}

// ============================================
// Mock Stripe Client
// ============================================

export const mockStripe = {
  checkout: {
    sessions: {
      create: vi.fn().mockImplementation(async () => createMockCheckoutSession()),
      retrieve: vi.fn().mockImplementation(async (id: string) => 
        createMockCheckoutSession({ id })
      ),
      expire: vi.fn().mockImplementation(async (id: string) => 
        createMockCheckoutSession({ id, status: 'expired' })
      ),
    },
  },
  subscriptions: {
    create: vi.fn().mockImplementation(async () => createMockSubscription()),
    retrieve: vi.fn().mockImplementation(async (id: string) => 
      createMockSubscription({ id })
    ),
    update: vi.fn().mockImplementation(async (id: string, data: Partial<MockSubscription>) => 
      createMockSubscription({ id, ...data })
    ),
    cancel: vi.fn().mockImplementation(async (id: string) => 
      createMockSubscription({ id, status: 'canceled' })
    ),
  },
  customers: {
    create: vi.fn().mockResolvedValue({ id: 'cus_test_new' }),
    retrieve: vi.fn().mockResolvedValue({ id: 'cus_test_123', email: 'test@test.com' }),
  },
  webhooks: {
    constructEvent: vi.fn().mockImplementation((_payload, _sig, _secret) => ({
      type: 'checkout.session.completed',
      data: { object: createMockCheckoutSession({ payment_status: 'paid', status: 'complete' }) },
    })),
  },
};

/**
 * Reset all Stripe mocks
 */
export function resetStripeMocks() {
  sessionCounter = 0;
  subscriptionCounter = 0;
  vi.clearAllMocks();
}

/**
 * Configure mock to simulate errors
 */
export function configureStripeError(method: 'create' | 'retrieve', error: Error) {
  mockStripe.checkout.sessions[method].mockRejectedValueOnce(error);
}

export default mockStripe;


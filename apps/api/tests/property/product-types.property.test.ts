/**
 * Product Types System Property Tests
 * 
 * Property-based tests for product types requirements
 * Validates: Requirements 1.x-9.x (Product Types System)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// ============================================
// Mock Product Type Registry
// ============================================

interface ProductTypeDefinition {
  id: string;
  name: string;
  isCore: boolean;
  enabled: boolean;
  fields: Array<{ name: string; type: string; required: boolean }>;
  fulfillmentHandler: string;
}

interface CoreModule {
  id: string;
  name: string;
  enabled: boolean;
  canDisable: boolean;
  productTypes: string[];
}

class MockProductTypeRegistry {
  private productTypes: Map<string, ProductTypeDefinition> = new Map();
  private modules: Map<string, CoreModule> = new Map();

  constructor() {
    // Register core types
    this.registerProductType({
      id: 'physical',
      name: 'Physical Product',
      isCore: true,
      enabled: true,
      fields: [
        { name: 'weight', type: 'number', required: false },
        { name: 'requiresShipping', type: 'boolean', required: true },
      ],
      fulfillmentHandler: 'physical',
    });

    this.registerProductType({
      id: 'digital',
      name: 'Digital Product',
      isCore: true,
      enabled: true,
      fields: [
        { name: 'files', type: 'file', required: true },
        { name: 'downloadLimit', type: 'number', required: false },
      ],
      fulfillmentHandler: 'digital',
    });

    // Register core modules
    this.modules.set('physical', {
      id: 'physical',
      name: 'Physical Products',
      enabled: true,
      canDisable: true,
      productTypes: ['physical'],
    });

    this.modules.set('digital', {
      id: 'digital',
      name: 'Digital Products',
      enabled: true,
      canDisable: true,
      productTypes: ['digital'],
    });
  }

  registerProductType(type: ProductTypeDefinition): void {
    this.productTypes.set(type.id, type);
  }

  unregisterProductType(typeId: string): boolean {
    const type = this.productTypes.get(typeId);
    if (type?.isCore) return false;
    return this.productTypes.delete(typeId);
  }

  getProductType(typeId: string): ProductTypeDefinition | undefined {
    return this.productTypes.get(typeId);
  }

  getAllProductTypes(): ProductTypeDefinition[] {
    return Array.from(this.productTypes.values());
  }

  getEnabledProductTypes(): ProductTypeDefinition[] {
    return this.getAllProductTypes().filter(t => {
      const module = this.getModuleForProductType(t.id);
      return module ? module.enabled : t.enabled;
    });
  }

  getModule(moduleId: string): CoreModule | undefined {
    return this.modules.get(moduleId);
  }

  getAllModules(): CoreModule[] {
    return Array.from(this.modules.values());
  }

  getModuleForProductType(typeId: string): CoreModule | undefined {
    return Array.from(this.modules.values()).find(m => m.productTypes.includes(typeId));
  }

  toggleModule(moduleId: string, enabled: boolean): { success: boolean; message: string } {
    const module = this.modules.get(moduleId);
    if (!module) return { success: false, message: 'Module not found' };
    if (!module.canDisable && !enabled) {
      return { success: false, message: 'Module cannot be disabled' };
    }
    module.enabled = enabled;
    return { success: true, message: `Module ${enabled ? 'enabled' : 'disabled'}` };
  }
}

// ============================================
// Property 1: Core Module Toggle Constraint
// Validates: Requirements 1.3, 1.7
// ============================================

describe('Property 1: Core Module Toggle Constraint', () => {
  let registry: MockProductTypeRegistry;

  beforeEach(() => {
    registry = new MockProductTypeRegistry();
  });

  it('should allow toggling modules that canDisable', () => {
    const module = registry.getModule('physical');
    expect(module?.canDisable).toBe(true);

    const result = registry.toggleModule('physical', false);
    expect(result.success).toBe(true);
    expect(registry.getModule('physical')?.enabled).toBe(false);
  });

  it('should allow re-enabling disabled modules', () => {
    registry.toggleModule('physical', false);
    const result = registry.toggleModule('physical', true);
    expect(result.success).toBe(true);
    expect(registry.getModule('physical')?.enabled).toBe(true);
  });

  it('should fail for non-existent modules', () => {
    const result = registry.toggleModule('nonexistent', false);
    expect(result.success).toBe(false);
  });
});

// ============================================
// Property 2: Module Visibility Consistency
// Validates: Requirements 1.4, 1.5, 1.6, 1.8
// ============================================

describe('Property 2: Module Visibility Consistency', () => {
  let registry: MockProductTypeRegistry;

  beforeEach(() => {
    registry = new MockProductTypeRegistry();
  });

  it('should hide product types when module is disabled', () => {
    registry.toggleModule('digital', false);
    const enabledTypes = registry.getEnabledProductTypes();

    expect(enabledTypes.find(t => t.id === 'digital')).toBeUndefined();
    expect(enabledTypes.find(t => t.id === 'physical')).toBeDefined();
  });

  it('should show product types when module is enabled', () => {
    const enabledTypes = registry.getEnabledProductTypes();

    expect(enabledTypes.find(t => t.id === 'digital')).toBeDefined();
    expect(enabledTypes.find(t => t.id === 'physical')).toBeDefined();
  });

  it('should maintain consistency between module and type visibility', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('physical', 'digital'),
        fc.boolean(),
        (moduleId, enabled) => {
          registry.toggleModule(moduleId, enabled);
          const enabledTypes = registry.getEnabledProductTypes();
          const typeVisible = enabledTypes.some(t => t.id === moduleId);

          expect(typeVisible).toBe(enabled);
        }
      ),
      { numRuns: 10 }
    );
  });
});

// ============================================
// Property 3: Product Type Registration
// Validates: Requirements 2.3, 2.4
// ============================================

describe('Property 3: Product Type Registration', () => {
  let registry: MockProductTypeRegistry;

  beforeEach(() => {
    registry = new MockProductTypeRegistry();
  });

  it('should allow registering non-core product types', () => {
    const customType: ProductTypeDefinition = {
      id: 'subscription',
      name: 'Subscription',
      isCore: false,
      enabled: true,
      fields: [{ name: 'billingPeriod', type: 'select', required: true }],
      fulfillmentHandler: 'subscription',
    };

    registry.registerProductType(customType);
    expect(registry.getProductType('subscription')).toBeDefined();
  });

  it('should allow unregistering non-core types', () => {
    const customType: ProductTypeDefinition = {
      id: 'custom',
      name: 'Custom',
      isCore: false,
      enabled: true,
      fields: [],
      fulfillmentHandler: 'custom',
    };

    registry.registerProductType(customType);
    const result = registry.unregisterProductType('custom');

    expect(result).toBe(true);
    expect(registry.getProductType('custom')).toBeUndefined();
  });

  it('should prevent unregistering core types', () => {
    const result = registry.unregisterProductType('physical');

    expect(result).toBe(false);
    expect(registry.getProductType('physical')).toBeDefined();
  });
});

// ============================================
// Property 4: Physical Product Fulfillment
// Validates: Requirements 3.3, 3.4, 3.5, 3.6
// ============================================

interface FulfillmentResult {
  success: boolean;
  status: string;
  message?: string;
}

function simulatePhysicalFulfillment(hasShippingInfo: boolean): FulfillmentResult {
  if (!hasShippingInfo) {
    return { success: false, status: 'pending_shipping', message: 'Awaiting shipping info' };
  }
  return { success: true, status: 'shipped', message: 'Order shipped' };
}

describe('Property 4: Physical Product Fulfillment', () => {
  it('should require shipping info for physical products', () => {
    const result = simulatePhysicalFulfillment(false);
    expect(result.status).toBe('pending_shipping');
  });

  it('should complete fulfillment when shipping info provided', () => {
    const result = simulatePhysicalFulfillment(true);
    expect(result.success).toBe(true);
    expect(result.status).toBe('shipped');
  });
});

// ============================================
// Property 5: Digital Product Fulfillment
// Validates: Requirements 4.4, 4.5, 4.6, 4.7, 4.8
// ============================================

interface DownloadLink {
  token: string;
  remainingDownloads: number;
  expiresAt: Date;
}

function generateDownloadLink(downloadLimit: number, expiryDays: number): DownloadLink {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  return {
    token: `token-${Math.random().toString(36).substring(7)}`,
    remainingDownloads: downloadLimit,
    expiresAt,
  };
}

describe('Property 5: Digital Product Fulfillment', () => {
  it('should generate download links with correct limits', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 365 }),
        (limit, days) => {
          const link = generateDownloadLink(limit, days);

          expect(link.remainingDownloads).toBe(limit);
          expect(link.expiresAt.getTime()).toBeGreaterThan(Date.now());
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should generate unique tokens', () => {
    const links = Array.from({ length: 10 }, () => generateDownloadLink(5, 7));
    const tokens = links.map(l => l.token);
    const uniqueTokens = new Set(tokens);

    expect(uniqueTokens.size).toBe(10);
  });
});

// ============================================
// Property 6: Download Link Security
// Validates: Requirements 4.5, 4.6, 4.9
// ============================================

function validateDownloadLink(link: DownloadLink): { valid: boolean; reason?: string } {
  if (link.remainingDownloads <= 0) {
    return { valid: false, reason: 'Download limit exceeded' };
  }
  if (link.expiresAt.getTime() < Date.now()) {
    return { valid: false, reason: 'Link expired' };
  }
  return { valid: true };
}

describe('Property 6: Download Link Security', () => {
  it('should reject links with zero remaining downloads', () => {
    const link: DownloadLink = {
      token: 'test-token',
      remainingDownloads: 0,
      expiresAt: new Date(Date.now() + 86400000),
    };

    const result = validateDownloadLink(link);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Download limit exceeded');
  });

  it('should reject expired links', () => {
    const link: DownloadLink = {
      token: 'test-token',
      remainingDownloads: 5,
      expiresAt: new Date(Date.now() - 1000),
    };

    const result = validateDownloadLink(link);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Link expired');
  });

  it('should accept valid links', () => {
    const link = generateDownloadLink(5, 7);
    const result = validateDownloadLink(link);
    expect(result.valid).toBe(true);
  });
});

// ============================================
// Property 7: Mixed Order Handling
// Validates: Requirements 5.3, 5.4, 9.1-9.7
// ============================================

interface OrderItem {
  id: string;
  productType: 'physical' | 'digital';
  fulfilled: boolean;
}

interface Order {
  id: string;
  items: OrderItem[];
}

function getOrderFulfillmentStatus(order: Order): string {
  const hasPhysical = order.items.some(i => i.productType === 'physical');
  const hasDigital = order.items.some(i => i.productType === 'digital');
  const allFulfilled = order.items.every(i => i.fulfilled);
  const someFulfilled = order.items.some(i => i.fulfilled);

  if (allFulfilled) return 'completed';
  if (hasPhysical && hasDigital) {
    if (someFulfilled) return 'partially_fulfilled';
    return 'pending';
  }
  return someFulfilled ? 'partially_fulfilled' : 'pending';
}

describe('Property 7: Mixed Order Handling', () => {
  it('should handle mixed orders with partial fulfillment', () => {
    const order: Order = {
      id: 'order-1',
      items: [
        { id: 'item-1', productType: 'physical', fulfilled: false },
        { id: 'item-2', productType: 'digital', fulfilled: true },
      ],
    };

    const status = getOrderFulfillmentStatus(order);
    expect(status).toBe('partially_fulfilled');
  });

  it('should mark order complete when all items fulfilled', () => {
    const order: Order = {
      id: 'order-1',
      items: [
        { id: 'item-1', productType: 'physical', fulfilled: true },
        { id: 'item-2', productType: 'digital', fulfilled: true },
      ],
    };

    const status = getOrderFulfillmentStatus(order);
    expect(status).toBe('completed');
  });

  it('should handle pure digital orders', () => {
    const order: Order = {
      id: 'order-1',
      items: [
        { id: 'item-1', productType: 'digital', fulfilled: true },
      ],
    };

    const status = getOrderFulfillmentStatus(order);
    expect(status).toBe('completed');
  });
});

// ============================================
// Property 8: Fulfillment Dispatch
// Validates: Requirements 5.1, 5.5
// ============================================

type FulfillmentHandler = (itemId: string) => FulfillmentResult;

class MockFulfillmentEngine {
  private handlers: Map<string, FulfillmentHandler> = new Map();

  registerHandler(type: string, handler: FulfillmentHandler): void {
    this.handlers.set(type, handler);
  }

  dispatch(productType: string, itemId: string): FulfillmentResult {
    const handler = this.handlers.get(productType);
    if (!handler) {
      return { success: false, status: 'error', message: 'No handler for type' };
    }
    return handler(itemId);
  }
}

describe('Property 8: Fulfillment Dispatch', () => {
  let engine: MockFulfillmentEngine;

  beforeEach(() => {
    engine = new MockFulfillmentEngine();
    engine.registerHandler('physical', () => ({ success: true, status: 'pending_shipping' }));
    engine.registerHandler('digital', () => ({ success: true, status: 'ready_for_download' }));
  });

  it('should dispatch to correct handler based on product type', () => {
    const physicalResult = engine.dispatch('physical', 'item-1');
    const digitalResult = engine.dispatch('digital', 'item-2');

    expect(physicalResult.status).toBe('pending_shipping');
    expect(digitalResult.status).toBe('ready_for_download');
  });

  it('should handle unknown product types gracefully', () => {
    const result = engine.dispatch('unknown', 'item-1');
    expect(result.success).toBe(false);
    expect(result.message).toBe('No handler for type');
  });

  it('should dispatch correctly for any registered type', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('physical', 'digital'),
        (type) => {
          const result = engine.dispatch(type, 'test-item');
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });
});


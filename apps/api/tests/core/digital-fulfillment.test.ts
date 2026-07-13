/**
 * Digital Fulfillment E2E Test (Task 7.1.3)
 *
 * Tests the complete digital goods purchase → fulfillment → delivery flow:
 * 1. Digital delivery email template rendering
 * 2. Digital item extraction from order items
 * 3. Fulfillment data structure validation
 * 4. Order success page digital delivery display
 */

import { describe, it, expect } from 'vitest';
import {
  renderDigitalDeliveryEmail,
  extractDigitalItems,
} from '@/core/notification/digital-delivery-email';

describe('Digital Fulfillment — Email Template', () => {
  describe('extractDigitalItems', () => {
    it('should extract items with fulfillment data', () => {
      const items = [
        {
          productName: 'eSIM Global 10GB',
          quantity: 1,
          fulfillmentStatus: 'delivered',
          fulfillmentData: {
            qrCodeContent: 'LPA:1$example.com$TEST123',
            planId: 'plan-abc',
            productClass: 'esim',
          },
        },
        {
          productName: 'Physical T-Shirt',
          quantity: 2,
          fulfillmentStatus: null,
          fulfillmentData: null,
        },
        {
          productName: 'Gift Card $50',
          quantity: 1,
          fulfillmentStatus: 'delivered',
          fulfillmentData: {
            cardUid: 'GIFT-CODE-ABC123XYZ',
            productClass: 'card',
          },
        },
      ];

      const digital = extractDigitalItems(items);
      expect(digital).toHaveLength(2);
      expect(digital[0].productName).toBe('eSIM Global 10GB');
      expect(digital[1].productName).toBe('Gift Card $50');
    });

    it('should return empty array for physical-only orders', () => {
      const items = [
        {
          productName: 'T-Shirt',
          quantity: 1,
          fulfillmentStatus: null,
          fulfillmentData: null,
        },
      ];

      const digital = extractDigitalItems(items);
      expect(digital).toHaveLength(0);
    });

    it('should return empty array for empty items', () => {
      expect(extractDigitalItems([])).toHaveLength(0);
    });
  });

  describe('renderDigitalDeliveryEmail', () => {
    it('should render eSIM delivery email with QR code info', () => {
      const result = renderDigitalDeliveryEmail({
        orderNumber: 'ORD-TEST-001',
        customerEmail: 'test@example.com',
        storeName: 'TestStore',
        items: [
          {
            productName: 'eSIM Global 10GB',
            quantity: 1,
            fulfillmentStatus: 'delivered',
            fulfillmentData: {
              qrCodeContent: 'LPA:1$example.com$TEST123',
              planId: 'plan-global-10gb',
              productClass: 'esim',
            },
          },
        ],
      });

      expect(result.subject).toContain('ORD-TEST-001');
      expect(result.subject).toContain('TestStore');
      expect(result.html).toContain('eSIM Global 10GB');
      expect(result.html).toContain('QR Code');
      expect(result.html).toContain('plan-global-10gb');
      expect(result.html).toContain('delivered');
      expect(result.text).toContain('eSIM Global 10GB');
      expect(result.text).toContain('plan-global-10gb');
    });

    it('should render gift card delivery email with redemption code', () => {
      const result = renderDigitalDeliveryEmail({
        orderNumber: 'ORD-TEST-002',
        customerEmail: 'test@example.com',
        storeName: 'TestStore',
        items: [
          {
            productName: 'Gift Card $50',
            quantity: 1,
            fulfillmentStatus: 'delivered',
            fulfillmentData: {
              cardUid: 'GIFT-CODE-ABC123XYZ',
              productClass: 'card',
            },
          },
        ],
      });

      expect(result.html).toContain('Gift Card $50');
      expect(result.html).toContain('Redemption Code');
      expect(result.html).toContain('GIFT-CODE-ABC123XYZ');
      expect(result.text).toContain('GIFT-CODE-ABC123XYZ');
    });

    it('should render download link delivery email', () => {
      const result = renderDigitalDeliveryEmail({
        orderNumber: 'ORD-TEST-003',
        customerEmail: 'test@example.com',
        storeName: 'TestStore',
        items: [
          {
            productName: 'E-Book Bundle',
            quantity: 1,
            fulfillmentStatus: 'delivered',
            fulfillmentData: {
              downloadUrl: 'https://example.com/download/file.pdf',
            },
          },
        ],
      });

      expect(result.html).toContain('E-Book Bundle');
      expect(result.html).toContain('Download');
      expect(result.html).toContain('https://example.com/download/file.pdf');
      expect(result.text).toContain('https://example.com/download/file.pdf');
    });

    it('should render product code for generic digital goods', () => {
      const result = renderDigitalDeliveryEmail({
        orderNumber: 'ORD-TEST-004',
        customerEmail: 'test@example.com',
        storeName: 'TestStore',
        items: [
          {
            productName: 'Software License',
            quantity: 1,
            fulfillmentStatus: 'delivered',
            fulfillmentData: {
              productCode: 'LIC-KEY-7890-QWER',
            },
          },
        ],
      });

      expect(result.html).toContain('Software License');
      expect(result.html).toContain('Product Code');
      expect(result.html).toContain('LIC-KEY-7890-QWER');
    });

    it('should return empty for non-digital orders', () => {
      const result = renderDigitalDeliveryEmail({
        orderNumber: 'ORD-TEST-005',
        customerEmail: 'test@example.com',
        storeName: 'TestStore',
        items: [
          {
            productName: 'Physical T-Shirt',
            quantity: 2,
            fulfillmentStatus: null,
            fulfillmentData: null,
          },
        ],
      });

      expect(result.html).toBe('');
      expect(result.text).toBe('');
      expect(result.subject).toBe('');
    });

    it('should render multiple digital items in same email', () => {
      const result = renderDigitalDeliveryEmail({
        orderNumber: 'ORD-TEST-006',
        customerEmail: 'test@example.com',
        storeName: 'TestStore',
        items: [
          {
            productName: 'eSIM Global 10GB',
            quantity: 1,
            fulfillmentStatus: 'delivered',
            fulfillmentData: {
              qrCodeContent: 'LPA:1$example.com$TEST',
              planId: 'plan-1',
              productClass: 'esim',
            },
          },
          {
            productName: 'Gift Card $50',
            quantity: 1,
            fulfillmentStatus: 'processing',
            fulfillmentData: {
              cardUid: 'GIFT-CODE-123',
              productClass: 'card',
            },
          },
          {
            productName: 'E-Book',
            quantity: 1,
            fulfillmentStatus: 'delivered',
            fulfillmentData: {
              downloadUrl: 'https://example.com/book.pdf',
            },
          },
        ],
      });

      expect(result.html).toContain('eSIM Global 10GB');
      expect(result.html).toContain('Gift Card $50');
      expect(result.html).toContain('E-Book');
      expect(result.html).toContain('GIFT-CODE-123');
      expect(result.html).toContain('https://example.com/book.pdf');
    });

    it('should escape HTML in product names and codes', () => {
      const result = renderDigitalDeliveryEmail({
        orderNumber: 'ORD-TEST-007',
        customerEmail: 'test@example.com',
        storeName: 'TestStore',
        items: [
          {
            productName: '<script>alert("xss")</script>',
            quantity: 1,
            fulfillmentStatus: 'delivered',
            fulfillmentData: {
              cardUid: '<img src=x onerror=alert(1)>',
            },
          },
        ],
      });

      expect(result.html).not.toContain('<script>');
      expect(result.html).not.toContain('<img src=x');
      expect(result.html).toContain('&lt;script&gt;');
    });

    it('should show processing status for pending fulfillment', () => {
      const result = renderDigitalDeliveryEmail({
        orderNumber: 'ORD-TEST-008',
        customerEmail: 'test@example.com',
        storeName: 'TestStore',
        items: [
          {
            productName: 'Pre-order Game Key',
            quantity: 1,
            fulfillmentStatus: 'processing',
            fulfillmentData: {
              productCode: 'PENDING-KEY',
            },
          },
        ],
      });

      expect(result.html).toContain('processing');
    });
  });
});

describe('Digital Fulfillment — Data Flow', () => {
  it('should handle eSIM fulfillment data structure', () => {
    const fulfillmentData = {
      qrCodeContent: 'LPA:1$example.com$TEST123',
      planId: 'plan-global-10gb',
      productClass: 'esim',
      externalOrderRef: 'ext-001',
      externalStatus: 'actived',
    };

    const items = [
      {
        productName: 'eSIM Global 10GB',
        quantity: 1,
        fulfillmentStatus: 'delivered' as const,
        fulfillmentData,
      },
    ];

    const digital = extractDigitalItems(items);
    expect(digital).toHaveLength(1);
    expect(digital[0].fulfillmentData?.qrCodeContent).toBe('LPA:1$example.com$TEST123');
  });

  it('should handle card-code fulfillment data structure', () => {
    const fulfillmentData = {
      cardUid: 'GIFT-CODE-ABC123XYZ',
      productClass: 'card',
      productCode: 'CARD-001',
    };

    const items = [
      {
        productName: 'Gift Card $50',
        quantity: 1,
        fulfillmentStatus: 'delivered' as const,
        fulfillmentData,
      },
    ];

    const digital = extractDigitalItems(items);
    expect(digital).toHaveLength(1);
    expect(digital[0].fulfillmentData?.cardUid).toBe('GIFT-CODE-ABC123XYZ');
  });

  it('should handle download link fulfillment data structure', () => {
    const fulfillmentData = {
      downloadUrl: 'https://example.com/files/ebook.pdf',
      productClass: 'digital',
    };

    const items = [
      {
        productName: 'E-Book Bundle',
        quantity: 1,
        fulfillmentStatus: 'delivered' as const,
        fulfillmentData,
      },
    ];

    const digital = extractDigitalItems(items);
    expect(digital).toHaveLength(1);
    expect(digital[0].fulfillmentData?.downloadUrl).toBe('https://example.com/files/ebook.pdf');
  });

  it('should handle mixed digital + physical order', () => {
    const items = [
      {
        productName: 'eSIM 10GB',
        quantity: 1,
        fulfillmentStatus: 'delivered' as const,
        fulfillmentData: { qrCodeContent: 'LPA:1$test', productClass: 'esim' },
      },
      {
        productName: 'Phone Case',
        quantity: 1,
        fulfillmentStatus: null,
        fulfillmentData: null,
      },
      {
        productName: 'Gift Card $25',
        quantity: 2,
        fulfillmentStatus: 'delivered' as const,
        fulfillmentData: { cardUid: 'CODE-123', productClass: 'card' },
      },
    ];

    const digital = extractDigitalItems(items);
    expect(digital).toHaveLength(2);
    expect(digital[0].productName).toBe('eSIM 10GB');
    expect(digital[1].productName).toBe('Gift Card $25');
  });
});

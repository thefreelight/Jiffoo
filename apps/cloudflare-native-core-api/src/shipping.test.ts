import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));
vi.mock('./plugin-settings', () => ({
  getNativePluginConfig: vi.fn(),
  getNativePluginSecret: vi.fn(),
}));

const { normalizeOdooWebhook } = await import('./external-orders');
const { nextShipmentStatus, normalizeShipmentStatus } = await import('./shipments');

describe('native shipment normalization', () => {
  it('normalizes the public status contract and carrier error aliases', () => {
    expect([
      'PENDING', 'READY_TO_SHIP', 'SHIPPED', 'IN_TRANSIT',
      'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'CANCELLED',
    ].map(normalizeShipmentStatus)).toEqual([
      'PENDING', 'READY_TO_SHIP', 'SHIPPED', 'IN_TRANSIT',
      'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'CANCELLED',
    ]);
    expect(normalizeShipmentStatus('out-for-delivery')).toBe('OUT_FOR_DELIVERY');
    expect(normalizeShipmentStatus('failed')).toBe('EXCEPTION');
    expect(normalizeShipmentStatus('unknown-carrier-state')).toBe('PENDING');
  });

  it('does not regress progress when Odoo callbacks arrive out of order', () => {
    expect(nextShipmentStatus('IN_TRANSIT', 'SHIPPED')).toBe('IN_TRANSIT');
    expect(nextShipmentStatus('OUT_FOR_DELIVERY', 'IN_TRANSIT')).toBe('OUT_FOR_DELIVERY');
    expect(nextShipmentStatus('DELIVERED', 'EXCEPTION')).toBe('DELIVERED');
    expect(nextShipmentStatus('SHIPPED', 'CANCELLED')).toBe('SHIPPED');
    expect(nextShipmentStatus('READY_TO_SHIP', 'CANCELLED')).toBe('CANCELLED');
    expect(nextShipmentStatus('EXCEPTION', 'IN_TRANSIT')).toBe('IN_TRANSIT');
  });
});

describe('Odoo shipment webhook normalization', () => {
  it('maps nested snake_case shipment payloads', () => {
    expect(normalizeOdooWebhook({
      client_order_ref: 'native-order-1-item-1',
      state: 'done',
      shipping: {
        shipment_id: 'picking-42',
        carrier_code: 'DHL',
        carrier_name: 'DHL Express',
        tracking_number: 'TRACK-42',
        tracking_url: 'https://tracking.example/TRACK-42',
        shipment_status: 'in_transit',
        date_done: '2026-08-02T10:00:00Z',
        scheduled_date: '2026-08-04T10:00:00Z',
        write_date: '2026-08-02T11:00:00Z',
      },
    })).toMatchObject({
      provider: 'odoo',
      externalOrderRef: 'native-order-1-item-1',
      externalStatus: 'done',
      shipmentId: 'picking-42',
      carrierCode: 'DHL',
      carrierName: 'DHL Express',
      trackingNumber: 'TRACK-42',
      trackingUrl: 'https://tracking.example/TRACK-42',
      shipmentStatus: 'in_transit',
      shippedAt: '2026-08-02T10:00:00Z',
      estimatedDeliveryAt: '2026-08-04T10:00:00Z',
      lastCheckedAt: '2026-08-02T11:00:00Z',
    });
  });

  it('maps top-level camelCase payloads used by normalized integrations', () => {
    expect(normalizeOdooWebhook({
      externalOrderRef: 'native-order-2-item-2',
      externalStatus: 'processing',
      shipmentId: 'shipment-2',
      carrierCode: 'UPS',
      carrierName: 'UPS',
      trackingNumber: 'TRACK-2',
      trackingUrl: 'https://tracking.example/TRACK-2',
      shipmentStatus: 'SHIPPED',
    })).toMatchObject({
      provider: 'odoo',
      externalOrderRef: 'native-order-2-item-2',
      shipmentId: 'shipment-2',
      carrierCode: 'UPS',
      trackingNumber: 'TRACK-2',
      shipmentStatus: 'SHIPPED',
    });
  });
});

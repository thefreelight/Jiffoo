import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));
vi.mock('./plugin-settings', () => ({ getNativePluginConfig: vi.fn() }));

const { commissionEmailCopy, refundEmailCopy, shipmentEmailCopy } = await import('./mail-outbox');
const { checkoutLocale } = await import('./checkout');

describe('native transactional email locales', () => {
  it('persists an explicit Chinese checkout locale and falls back to Accept-Language', () => {
    const request = new Request('https://api.example.com/api/orders', { headers: { 'accept-language': 'zh-TW,zh;q=0.9' } });
    expect(checkoutLocale(request, 'zh-Hant')).toBe('zh-CN');
    expect(checkoutLocale(request)).toBe('zh-CN');
    expect(checkoutLocale(request, 'en')).toBe('en');
  });

  it('renders localized refund and commission copy', () => {
    expect(refundEmailCopy('zh-CN', {
      siteName: 'Bokmoo', orderId: 'ord_1', amount: 'USD 12.50', fullyRefunded: true, reason: '重复付款',
    })).toEqual({
      subject: 'Bokmoo 退款已完成：ord_1',
      text: '你的 Bokmoo 订单 ord_1 已完成退款：USD 12.50。 原因：重复付款',
    });
    expect(commissionEmailCopy('zh-CN', {
      siteName: 'Bokmoo', orderId: 'ord_1', amount: 'USD 2.50', organization: true,
    }).subject).toBe('Bokmoo 机构推广佣金已记录：ord_1');
  });

  it('renders localized shipment states and safely escapes tracking links', () => {
    const copy = shipmentEmailCopy('zh-CN', {
      siteName: 'Bokmoo', orderId: 'ord_1', status: 'SHIPPED', carrier: 'DHL',
      trackingNumber: 'TRACK-1', trackingUrl: 'https://tracking.example/?a=1&b=2',
    });
    expect(copy.subject).toBe('你的 Bokmoo 订单已发货');
    expect(copy.text).toContain('物流单号：TRACK-1');
    expect(copy.html).toContain('a=1&amp;b=2');
    expect(copy.html).toContain('查看物流');
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));
vi.mock('./plugin-settings', () => ({ getNativePluginConfig: vi.fn() }));
vi.mock('./smtp', () => ({ sendSmtpEmail: vi.fn(async () => '<sent@test.local>') }));

const { commissionEmailCopy, orderPaidEmailCopy, processNativeEmailOutbox, refundEmailCopy, shipmentEmailCopy } = await import('./mail-outbox');
const { checkoutLocale } = await import('./checkout');

describe('native transactional email locales', () => {
  it('persists an explicit Chinese checkout locale and falls back to Accept-Language', () => {
    const request = new Request('https://api.example.com/api/orders', { headers: { 'accept-language': 'zh-TW,zh;q=0.9' } });
    expect(checkoutLocale(request, 'zh-Hant')).toBe('zh-CN');
    expect(checkoutLocale(request)).toBe('zh-CN');
    expect(checkoutLocale(request, 'en')).toBe('en');
  });

  it('renders localized refund and commission copy', () => {
    const refund = refundEmailCopy('zh-CN', {
      siteName: 'Bokmoo', orderId: 'ord_1', amount: 'USD 12.50', fullyRefunded: true, reason: '重复付款',
    });
    expect(refund.subject).toBe('Bokmoo 退款已完成：ord_1');
    expect(refund.text).toBe('你的 Bokmoo 订单 ord_1 已完成退款：USD 12.50。 原因：重复付款');
    expect(refund.html).toContain('退款金额');
    expect(refund.html).toContain('USD 12.50');
    expect(refund.html).toContain('原因');
    const commission = commissionEmailCopy('zh-CN', {
      siteName: 'Bokmoo', orderId: 'ord_1', amount: 'USD 2.50', organization: true,
    });
    expect(commission.subject).toBe('Bokmoo 机构推广佣金已记录：ord_1');
    expect(commission.html).toContain('佣金金额');
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

  it('renders the paid-order email with items, totals, and a success badge in Chinese', () => {
    const copy = orderPaidEmailCopy('zh-CN', {
      siteName: 'Bokmoo',
      orderId: 'ord_mugwtpwj_4426698ff144',
      currency: 'USD',
      items: [
        { name: '_registry sleep<&>', variant: '标准版', quantity: 2, unitPrice: 9.9, totalPrice: 19.8 },
      ],
      subtotal: 19.8,
      shipping: 5,
      total: 24.8,
      createdAt: '2026-09-25T12:08:00.000Z',
    });
    expect(copy.subject).toBe('Bokmoo 订单已支付：ord_mugwtpwj_4426698ff144');
    expect(copy.text).toBe('你的 Bokmoo 订单 ord_mugwtpwj_4426698ff144 已支付成功，合计 USD 24.80，我们会尽快处理。');
    expect(copy.html).toContain('支付成功');
    expect(copy.html).toContain('感谢你的购买');
    expect(copy.html).toContain('ord_mugwtpwj_4426698ff144');
    expect(copy.html).toContain('商品明细');
    expect(copy.html).toContain('_registry sleep&lt;&amp;&gt;');
    expect(copy.html).toContain('标准版');
    expect(copy.html).toContain('USD 9.90');
    expect(copy.html).toContain('小计');
    expect(copy.html).toContain('运费');
    expect(copy.html).toContain('总计');
    expect(copy.html).toContain('USD 24.80');
    expect(copy.html).toContain('2026-09-25 12:08 UTC');
  });

  it('renders an English paid-order email and omits empty summary rows', () => {
    const copy = orderPaidEmailCopy('en', {
      siteName: 'Bokmoo',
      orderId: 'ord_2',
      currency: 'USD',
      items: [{ name: 'Pro plan', quantity: 1, unitPrice: 29, totalPrice: 29 }],
      subtotal: 29,
      shipping: 0,
      discount: 0,
      total: 29,
      createdAt: null,
    });
    expect(copy.subject).toBe('Bokmoo payment confirmed: ord_2');
    expect(copy.text).toBe('Your Bokmoo order ord_2 has been paid successfully (total USD 29.00) and is now being processed.');
    expect(copy.html).toContain('Payment successful');
    expect(copy.html).toContain('Order number');
    expect(copy.html).not.toContain('Shipping');
    expect(copy.html).not.toContain('Discount');
    expect(copy.html).not.toContain('Order date');
  });

  it('falls back gracefully when the order snapshot has no amounts or items', () => {
    const copy = orderPaidEmailCopy('zh-CN', {
      siteName: 'Bokmoo', orderId: 'ord_3', currency: 'USD', items: [],
    });
    expect(copy.text).toBe('你的 Bokmoo 订单 ord_3 已支付成功，我们会尽快处理。');
    expect(copy.html).not.toContain('商品明细');
    expect(copy.html).not.toContain('总计');
  });

  it('marks the row SENT without re-sending when sent-bookkeeping fails', async () => {
    const executed: string[] = [];
    const row = {
      id: 'row-1', recipient: 'user@example.com', subject: 's',
      text_body: 't', html_body: '<p>t</p>', attempt_count: 0,
    };
    const fakeDb = {
      prepare: (sql: string) => ({
        bind: () => ({
          all: async () => ({ results: [row] }),
          run: async () => {
            executed.push(sql);
            if (sql.includes('message_id = ?2')) throw new Error('D1_ERROR: no such column: message_id: SQLITE_ERROR');
            return { meta: { changes: 1 } };
          },
        }),
      }),
    };
    const env = { DB: fakeDb, JWT_SECRET: {} } as unknown as Parameters<typeof processNativeEmailOutbox>[0];
    const result = await processNativeEmailOutbox(env);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(executed.some((sql) => sql.includes("status = 'SENT', sent_at") && !sql.includes('message_id'))).toBe(true);
    expect(executed.some((sql) => sql.includes('next_attempt_at = ?2'))).toBe(false);
  });
});

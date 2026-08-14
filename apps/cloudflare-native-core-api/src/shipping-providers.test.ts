import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FourPxNativeProvider, Kuaidi100NativeProvider, md5Hex,
  signFourPx, signKuaidi100, signKuaidi100Webhook,
} from './shipping-providers';

afterEach(() => vi.restoreAllMocks());

describe('Cloudflare-native shipping provider signatures', () => {
  it('implements byte-correct MD5 without a Node runtime dependency', () => {
    expect(md5Hex('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5Hex('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(md5Hex('快递100')).toBe(createHash('md5').update('快递100').digest('hex'));
  });

  it('signs exact Kuaidi100 and 4PX request bytes', () => {
    const raw = '{"ref_no":"order-1","business_type":"BDS"}';
    expect(signKuaidi100(raw, '1725000000123', 'key-1', 'secret-1'))
      .toBe(createHash('md5').update(`${raw}1725000000123key-1secret-1`).digest('hex').toUpperCase());
    expect(signKuaidi100Webhook(raw, 'salt')).toBe(createHash('md5').update(`${raw}salt`).digest('hex').toUpperCase());
    expect(signFourPx({ appKey: 'app-key', appSecret: 'secret', method: 'ds.xms.order.create', version: '1.1.0', timestamp: 1722470400123, body: raw }))
      .toBe(createHash('md5').update(`app_keyapp-keyformatjsonmethodds.xms.order.createtimestamp1722470400123v1.1.0${raw}secret`).digest('hex'));
  });
});

describe('Cloudflare-native carrier requests', () => {
  it('uses the Kuaidi100 V2 label endpoint and signed form body', async () => {
    const carrierFetch = vi.fn(async () => Response.json({ success: true, code: 200, data: { taskId: 'task-1' } }));
    const provider = new Kuaidi100NativeProvider({ key: 'key-1', secret: 'secret-1' }, carrierFetch, () => 1725000000123);
    await provider.createLabel({ printType: 'NON', partnerId: 'partner', kuaidicom: 'ems' });
    const [url, init] = carrierFetch.mock.calls[0]!;
    const form = new URLSearchParams(String(init?.body));
    expect(url).toBe('https://api.kuaidi100.com/label/order');
    expect(form.get('method')).toBe('order');
    expect(form.get('sign')).toBe(signKuaidi100(form.get('param')!, '1725000000123', 'key-1', 'secret-1'));
  });

  it('maps all 4PX operations to their official method versions', async () => {
    const carrierFetch = vi.fn(async () => Response.json({ result: '1', data: {} }));
    const provider = new FourPxNativeProvider({ appKey: 'app', appSecret: 'secret', environment: 'test' }, carrierFetch, () => 1722470400123);
    await provider.create({ ref_no: 'order-1' });
    await provider.get({ request_no: 'order-1' });
    await provider.cancel({ request_no: 'order-1', cancel_reason: 'duplicate' });
    await provider.label({ request_no: 'order-1' });
    await provider.tracking({ deliveryOrderNo: 'track-1' });
    expect(carrierFetch.mock.calls.map(([url]) => {
      const parsed = new URL(String(url));
      return [parsed.origin, parsed.searchParams.get('method'), parsed.searchParams.get('v')];
    })).toEqual([
      ['https://open-test.4px.com', 'ds.xms.order.create', '1.1.0'],
      ['https://open-test.4px.com', 'ds.xms.order.get', '1.1.0'],
      ['https://open-test.4px.com', 'ds.xms.order.cancel', '1.0.0'],
      ['https://open-test.4px.com', 'ds.xms.label.get', '1.1.0'],
      ['https://open-test.4px.com', 'tr.order.tracking.get', '1.0.0'],
    ]);
  });

  it('marks mutation network failures as unknown outcomes', async () => {
    const carrierFetch = vi.fn(async () => { throw new Error('reset'); });
    const provider = new FourPxNativeProvider({ appKey: 'app', appSecret: 'secret', environment: 'live' }, carrierFetch);
    await expect(provider.create({ ref_no: 'order-1' })).rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true, outcomeUnknown: true });
    await expect(provider.get({ request_no: 'order-1' })).rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true, outcomeUnknown: false });
  });
});

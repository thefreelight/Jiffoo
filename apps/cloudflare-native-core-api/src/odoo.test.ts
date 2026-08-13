import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:sockets', () => ({ connect: vi.fn() }));
vi.mock('./plugin-settings', () => ({ getNativePluginConfig: vi.fn() }));

const { getNativePluginConfig } = await import('./plugin-settings');
const { mapNativeOdooCatalog, readNativeOdooCatalog, testNativeOdooConnection } = await import('./odoo');

afterEach(() => vi.unstubAllGlobals());

describe('Odoo native connection test', () => {
  it('uses read kwargs accepted by Odoo 19', async () => {
    vi.mocked(getNativePluginConfig).mockResolvedValue({
      enabled: true,
      config: {
        baseUrl: 'https://erp.example.com',
        database: 'store',
        username: 'integration@example.com',
        apiKey: 'secret',
      },
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: 5 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: [{ id: 5 }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(testNativeOdooConnection({} as never)).resolves.toEqual({
      database: 'store',
      username: 'integration@example.com',
      uid: 5,
    });

    const readRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(readRequest.params.args).toEqual([
      'store',
      5,
      'secret',
      'res.users',
      'read',
      [[5]],
      { fields: ['id'] },
    ]);
  });
});

describe('Odoo native catalog mapping', () => {
  it('uses Odoo 19 type fields when detailed_type is unavailable', async () => {
    vi.mocked(getNativePluginConfig).mockResolvedValue({
      enabled: true,
      config: {
        baseUrl: 'https://erp.example.com',
        database: 'store',
        username: 'integration@example.com',
        apiKey: 'secret',
      },
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: 5 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { type: { type: 'selection' }, is_storable: { type: 'boolean' } },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: [{
          id: 6,
          product_tmpl_id: [6, 'Bokmoo Basic Card'],
          display_name: 'Bokmoo Basic Card',
          default_code: 'BOKMOO-BASIC-CARD',
          list_price: 20,
          qty_available: 100,
          virtual_available: 100,
          active: true,
          sale_ok: true,
          type: 'consu',
          is_storable: true,
        }],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(readNativeOdooCatalog({} as never)).resolves.toMatchObject([{
      id: 'odoo-product-6',
      productKind: 'goods',
      requiresShipping: true,
      stock: 100,
      price: 20,
    }]);

    const fieldsRequest = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    expect(fieldsRequest.params.args[6].fields).toContain('type');
    expect(fieldsRequest.params.args[6].fields).toContain('is_storable');
    expect(fieldsRequest.params.args[6].fields).not.toContain('detailed_type');
  });

  it('keeps using detailed_type on older Odoo versions', async () => {
    vi.mocked(getNativePluginConfig).mockResolvedValue({
      enabled: true,
      config: {
        baseUrl: 'https://erp.example.com', database: 'store',
        username: 'integration@example.com', apiKey: 'secret',
      },
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: 5 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { detailed_type: { type: 'selection' }, type: { type: 'selection' } },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(readNativeOdooCatalog({} as never)).resolves.toEqual([]);
    const fieldsRequest = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    expect(fieldsRequest.params.args[6].fields).toContain('detailed_type');
    expect(fieldsRequest.params.args[6].fields).not.toContain('type');
  });

  it('groups variants and preserves sellable price, inventory, and fulfillment attributes', () => {
    const products = mapNativeOdooCatalog([
      {
        id: 21, product_tmpl_id: [7, 'Bokmoo Card'], display_name: 'Bokmoo Card / Black',
        default_code: 'BOK-CARD-BLK', list_price: 49, qty_available: 8, virtual_available: 10,
        active: true, sale_ok: true, detailed_type: 'product', description_sale: 'Physical card',
        write_date: '2026-08-02 12:00:00',
      },
      {
        id: 22, product_tmpl_id: [7, 'Bokmoo Card'], display_name: 'Bokmoo Card / Gold',
        default_code: 'BOK-CARD-GLD', list_price: 59, qty_available: 3, virtual_available: 3,
        active: false, sale_ok: true, detailed_type: 'product', description_sale: 'Physical card',
      },
    ]);

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      id: 'odoo-product-7', price: 49, stock: 11, productKind: 'goods', requiresShipping: true,
      variants: [
        { id: 'odoo-variant-21', skuCode: 'BOK-CARD-BLK', salePrice: 49, baseStock: 8, isActive: true },
        { id: 'odoo-variant-22', skuCode: 'BOK-CARD-GLD', salePrice: 59, baseStock: 3, isActive: false },
      ],
    });
  });

  it('caps sellable stock at Odoo forecast availability after reservations', () => {
    const products = mapNativeOdooCatalog([
      {
        id: 40, product_tmpl_id: [10, 'Reserved Card'], display_name: 'Reserved Card',
        default_code: 'BOK-RESERVED', list_price: 20, qty_available: 100, virtual_available: 97,
        active: true, sale_ok: true, detailed_type: 'product',
      },
    ]);

    expect(products[0]).toMatchObject({ stock: 97, variants: [{ baseStock: 97 }] });
  });

  it('does not expose negative or missing inventory', () => {
    const products = mapNativeOdooCatalog([
      {
        id: 41, product_tmpl_id: [11, 'Unavailable Card'], display_name: 'Unavailable Card',
        default_code: 'BOK-UNAVAILABLE', list_price: 20, qty_available: -2, virtual_available: -1,
        active: true, sale_ok: true, detailed_type: 'product',
      },
    ]);

    expect(products[0]).toMatchObject({ stock: 0, variants: [{ baseStock: 0 }] });
  });

  it('omits products that are not sellable', () => {
    expect(mapNativeOdooCatalog([
      { id: 30, product_tmpl_id: [9, 'Hidden'], sale_ok: false, detailed_type: 'product' },
    ])).toEqual([]);
  });
});

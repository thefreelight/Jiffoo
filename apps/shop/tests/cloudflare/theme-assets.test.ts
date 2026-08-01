import { describe, expect, it, vi } from 'vitest';
import { serveThemeAsset } from '@/lib/cloudflare/theme-assets';

function createBucket(body = 'theme-content', contentType = 'text/css') {
  const writeHttpMetadata = (headers: Headers) => headers.set('content-type', contentType);
  const object = {
    body: body as unknown as ReadableStream,
    httpEtag: '"theme-etag"',
    writeHttpMetadata,
  } as unknown as R2ObjectBody;
  return {
    get: vi.fn(async () => object),
  } as unknown as R2Bucket;
}

describe('Cloudflare storefront theme assets', () => {
  it('serves immutable versioned assets directly from R2', async () => {
    const bucket = createBucket();
    const response = await serveThemeAsset(
      new Request('https://shop.example.com/extensions/themes/shop/.versions/example/0.0.1/tokens.css'),
      bucket,
    );

    expect(response?.status).toBe(200);
    expect(response?.headers.get('content-type')).toBe('text/css');
    expect(response?.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(response?.headers.get('x-jiffoo-runtime')).toBe('cloudflare-shop-r2');
    expect(await response?.text()).toBe('theme-content');
  });

  it('does not intercept non-extension requests', async () => {
    const bucket = createBucket();
    await expect(
      serveThemeAsset(new Request('https://shop.example.com/en/products'), bucket),
    ).resolves.toBeNull();
    expect(bucket.get).not.toHaveBeenCalled();
  });

  it('rejects writes and missing assets without falling through', async () => {
    const bucket = createBucket();
    const writeResponse = await serveThemeAsset(
      new Request('https://shop.example.com/extensions/themes/shop/example/theme.json', { method: 'POST' }),
      bucket,
    );
    expect(writeResponse?.status).toBe(405);

    const missingBucket = { get: vi.fn(async () => null) } as unknown as R2Bucket;
    const missingResponse = await serveThemeAsset(
      new Request('https://shop.example.com/extensions/themes/shop/example/theme.json'),
      missingBucket,
    );
    expect(missingResponse?.status).toBe(404);
    expect(missingResponse?.headers.get('cache-control')).toBe('no-store');
  });
});

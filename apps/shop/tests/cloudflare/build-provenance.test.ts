import { describe, expect, it, vi } from 'vitest';
import { addBuildProvenance } from '@/lib/cloudflare/build-provenance';

describe('addBuildProvenance', () => {
  it('adds the deployed BUILD_ID without consuming the response body', async () => {
    const assets = {
      fetch: vi.fn().mockResolvedValue(new Response('8afd5d4ed\n')),
    };
    const original = new Response('shop', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });

    const response = await addBuildProvenance(
      new Request('https://demo.jiffoo.com/en'),
      original,
      assets,
    );

    expect(assets.fetch).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://demo.jiffoo.com/BUILD_ID' }),
    );
    expect(response.headers.get('x-jiffoo-build-id')).toBe('8afd5d4ed');
    expect(response.headers.get('content-type')).toContain('text/html');
    await expect(response.text()).resolves.toBe('shop');
  });

  it.each([
    new Response('missing', { status: 404 }),
    new Response('invalid build id with spaces'),
  ])('leaves the response unchanged when BUILD_ID is unavailable or invalid', async buildIdResponse => {
    const original = new Response('shop');
    const response = await addBuildProvenance(
      new Request('https://demo.jiffoo.com/en'),
      original,
      { fetch: vi.fn().mockResolvedValue(buildIdResponse) },
    );

    expect(response).toBe(original);
  });

  it('leaves the response unchanged when the assets binding fails', async () => {
    const original = new Response('shop');
    const response = await addBuildProvenance(
      new Request('https://demo.jiffoo.com/en'),
      original,
      { fetch: vi.fn().mockRejectedValue(new Error('assets unavailable')) },
    );

    expect(response).toBe(original);
  });
});

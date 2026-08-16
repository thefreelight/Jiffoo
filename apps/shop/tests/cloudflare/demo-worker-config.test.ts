import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('canonical Demo Shop Worker configuration', () => {
  const config = JSON.parse(
    readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8'),
  ) as {
    name: string;
    main: string;
    env?: {
      production?: {
        name?: string;
        routes?: Array<{ pattern?: string; custom_domain?: boolean }>;
        vars?: Record<string, string>;
        services?: Array<{ binding?: string; service?: string }>;
        r2_buckets?: Array<{ binding?: string; bucket_name?: string }>;
      };
    };
  };

  it('keeps the public Demo route and server API on the canonical Demo resources', () => {
    const production = config.env?.production;

    expect(config.name).toBe('jiffoo-shop');
    expect(config.main).toBe('cloudflare-entry.ts');
    expect(production?.name).toBe('jiffoo-shop');
    expect(production?.routes).toContainEqual({
      pattern: 'demo.jiffoo.com',
      custom_domain: true,
    });
    expect(production?.vars).toMatchObject({
      API_SERVICE_URL: 'https://demo-api.jiffoo.com',
      NEXT_PUBLIC_API_URL: '/api',
    });
    expect(production?.services).toContainEqual({
      binding: 'WORKER_SELF_REFERENCE',
      service: 'jiffoo-shop',
    });
    expect(production?.r2_buckets).toEqual(
      expect.arrayContaining([
        { binding: 'NEXT_INC_CACHE_R2_BUCKET', bucket_name: 'jiffoo-shop-cache' },
        { binding: 'THEME_ASSETS', bucket_name: 'jiffoo-theme-assets' },
      ]),
    );
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Bokmoo Cloudflare Worker entry', () => {
  const config = readFileSync(resolve(process.cwd(), 'wrangler.bokmoo.toml'), 'utf8');
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };

  it('routes requests through the Jiffoo entry that serves theme assets', () => {
    expect(config).toMatch(/^main\s*=\s*"cloudflare-entry\.ts"$/m);
    expect(config).toMatch(/^binding\s*=\s*"THEME_ASSETS"$/m);
    expect(config).toMatch(/^bucket_name\s*=\s*"bokmoo-production-assets"$/m);
    expect(config).toMatch(/^NEXT_PUBLIC_API_URL\s*=\s*"\/api"$/m);
    expect(config).not.toMatch(/^main\s*=\s*"\.open-next\/worker\.js"$/m);
    expect(packageJson.scripts['workers:build:bokmoo']).toContain('NEXT_PUBLIC_API_URL=/api');
    expect(packageJson.scripts['workers:build:bokmoo']).not.toContain('NEXT_PUBLIC_API_URL=https://');
  });
});

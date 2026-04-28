import { describe, expect, it } from 'vitest';
import { resolvePublicStoreName } from '@/core/store/branding';

describe('resolvePublicStoreName', () => {
  it('prefers explicit platform name when present', () => {
    expect(
      resolvePublicStoreName('GirlsFind Platform', {
        config: {
          brand: {
            name: 'girlsfind',
          },
        },
      }),
    ).toBe('GirlsFind Platform');
  });

  it('falls back to theme brand name when platform name is empty', () => {
    expect(
      resolvePublicStoreName('   ', {
        config: {
          brand: {
            name: 'girlsfind',
          },
        },
      }),
    ).toBe('girlsfind');
  });

  it('falls back to default store name when neither value exists', () => {
    expect(resolvePublicStoreName('', null)).toBe('Jiffoo Store');
  });
});

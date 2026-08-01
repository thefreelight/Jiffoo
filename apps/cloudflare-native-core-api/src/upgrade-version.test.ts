import { describe, expect, it } from 'vitest';
import { nativeUpgradeVersion } from './upgrade-version';

describe('native upgrade version metadata', () => {
  it('derives release metadata from the deployed runtime version', async () => {
    const response = nativeUpgradeVersion({ RUNTIME_VERSION: '1.2.3' });
    const payload = await response.json() as {
      data: { changelogUrl: string; releaseDate: null; releaseTag: string };
    };

    expect(payload.data.releaseTag).toBe('v1.2.3-opensource');
    expect(payload.data.changelogUrl).toBe(
      'https://github.com/thefreelight/Jiffoo/releases/tag/v1.2.3-opensource',
    );
    expect(payload.data.releaseDate).toBeNull();
  });
});

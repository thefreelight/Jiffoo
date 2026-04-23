import { describe, expect, it } from 'vitest';
import { OFFICIAL_LAUNCH_EXTENSIONS } from 'shared/extensions/official-catalog';

describe('official launch extension seed', () => {
  it('includes girls-importer as an official plugin seed entry', () => {
    expect(OFFICIAL_LAUNCH_EXTENSIONS).toContainEqual(
      expect.objectContaining({
        slug: 'girls-importer',
        kind: 'plugin',
        version: '0.1.1',
        packageUrl: 'https://get.jiffoo.com/official-artifacts/plugins/girls-importer/0.1.1.jplugin',
      }),
    );
  });
});

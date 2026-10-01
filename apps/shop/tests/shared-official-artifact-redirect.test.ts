import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { officialArtifactRedirect } from '../middleware';

function request(url: string, host = 'get.jiffoo.com') {
  return new NextRequest(url, { headers: { host } });
}

describe('official artifact download redirect', () => {
  it('redirects Marketplace package paths to the immutable R2 artifact host', () => {
    const response = officialArtifactRedirect(request(
      'https://get.jiffoo.com/official-artifacts/plugins/remoteradar-jobs/0.0.7.jplugin?download=1',
    ));

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe(
      'https://artifacts.jiffoo.com/official-artifacts/plugins/remoteradar-jobs/0.0.7.jplugin?download=1',
    );
  });

  it('does not redirect artifact-looking paths on other hosts', () => {
    expect(officialArtifactRedirect(request(
      'https://shop.jiffoo.com/official-artifacts/plugins/example/0.0.1.jplugin',
      'shop.jiffoo.com',
    ))).toBeNull();
  });
});

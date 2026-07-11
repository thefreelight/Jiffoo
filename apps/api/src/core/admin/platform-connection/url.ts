function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function trimApiSuffix(value: string): string {
  return value.replace(/\/api(?:\/v\d+)?$/i, '');
}

function isInternalPlatformHost(hostname: string): boolean {
  return (
    hostname === 'platform-api'
    || hostname.endsWith('.svc.cluster.local')
    || hostname.includes('platform-api.')
    || hostname.endsWith('.cluster.local')
  );
}

export function getPublicPlatformBaseUrl(): string {
  const explicit = process.env.MARKET_API_URL?.trim();
  if (explicit) {
    return trimApiSuffix(trimTrailingSlash(explicit));
  }

  const apiDomain = process.env.PLATFORM_API_DOMAIN?.trim();
  if (apiDomain) {
    return `https://${trimTrailingSlash(apiDomain)}`;
  }

  return 'https://platform-api.jiffoo.com';
}

export function normalizePlatformVerifyUrl(verifyUrl?: string | null): string {
  if (!verifyUrl || typeof verifyUrl !== 'string') {
    return '';
  }

  try {
    const original = new URL(verifyUrl);
    if (!isInternalPlatformHost(original.hostname)) {
      return verifyUrl;
    }

    const publicBase = new URL(getPublicPlatformBaseUrl());
    publicBase.pathname = original.pathname;
    publicBase.search = original.search;
    publicBase.hash = original.hash;
    return publicBase.toString();
  } catch {
    return verifyUrl;
  }
}

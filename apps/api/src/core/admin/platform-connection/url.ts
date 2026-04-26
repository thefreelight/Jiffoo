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

function parseHostname(value?: string | null): string | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function isSelfHostedSurfaceHost(hostname: string): boolean {
  const shopHost = parseHostname(process.env.NEXT_PUBLIC_SHOP_URL);
  const adminHost = parseHostname(process.env.NEXT_PUBLIC_ADMIN_URL);
  return hostname === shopHost || hostname === adminHost;
}

export function getPublicPlatformBaseUrl(): string {
  const explicit = process.env.MARKET_API_URL?.trim();
  if (explicit) {
    try {
      const explicitUrl = new URL(trimTrailingSlash(explicit));
      if (!isInternalPlatformHost(explicitUrl.hostname)) {
        return trimApiSuffix(explicitUrl.toString());
      }
    } catch {
      // ignore invalid explicit platform URL and fall back to public defaults
    }
  }

  const apiDomain = process.env.PLATFORM_API_DOMAIN?.trim();
  if (apiDomain && !isInternalPlatformHost(apiDomain) && !isSelfHostedSurfaceHost(apiDomain)) {
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

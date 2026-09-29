const providers = new Set(['ga4', 'meta', 'baidu']);

function loopback(hostname) {
  return hostname === 'localhost' || hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

export function resolveProviderLibraryOverrides(value, storefrontUrl) {
  if (value === undefined) return {};
  const fail = () => {
    throw new Error('STOREFRONT_PROVIDER_LIBRARY_OVERRIDES requires a loopback STOREFRONT_URL and data: or loopback HTTP(S) library URLs.');
  };
  let storefront;
  let overrides;
  try {
    storefront = new URL(storefrontUrl);
    overrides = JSON.parse(value);
  } catch {
    return fail();
  }
  if (!['http:', 'https:'].includes(storefront.protocol) || !loopback(storefront.hostname) ||
    !overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return fail();
  for (const [provider, url] of Object.entries(overrides)) {
    if (!providers.has(provider) || typeof url !== 'string') return fail();
    let parsed;
    try { parsed = new URL(url); } catch { return fail(); }
    if (parsed.protocol !== 'data:' &&
      (!['http:', 'https:'].includes(parsed.protocol) || !loopback(parsed.hostname))) return fail();
  }
  return overrides;
}

export function isOfficialMarketOnly(): boolean {
  if (typeof process.env.OFFICIAL_MARKET_ONLY === 'string') {
    return process.env.OFFICIAL_MARKET_ONLY === 'true';
  }
  return process.env.NODE_ENV === 'production';
}

export function isAllowedExtensionSource(source?: string | null): boolean {
  if (!isOfficialMarketOnly()) {
    return true;
  }
  return source === 'official-market' || source === 'builtin';
}

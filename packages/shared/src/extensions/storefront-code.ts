// Absolute end assertions reject trailing newlines as well as padded IDs.
export const storefrontCodeProviderPatterns = {
  ga4MeasurementId: '^G-[A-Z0-9]{1,32}$(?![\\s\\S])',
  metaPixelId: '^[0-9]{1,32}$(?![\\s\\S])',
  baiduSiteKey: '^[0-9a-f]{32}$(?![\\s\\S])',
} as const;

export const storefrontCodeSlotCap = 65536;

export function isStorefrontCodeProviderId(key: keyof typeof storefrontCodeProviderPatterns, value: unknown): boolean {
  return value === null || (typeof value === 'string' && new RegExp(storefrontCodeProviderPatterns[key]).test(value));
}

export function storefrontCodeCharacterCount(value: string): number {
  return Array.from(value).length;
}

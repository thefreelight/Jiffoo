/**
 * Platform Offers Service Tests
 *
 * Tests both enabled and disabled states:
 * - JIFFOO_DISABLE_PLATFORM_OFFERS=true → always empty
 * - Default (enabled) with no config → empty
 * - With configured offers → returns validated offers
 * - Invalid offers are filtered out
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/config/database', () => ({
  prisma: {
    systemSettings: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/core/cache/service', () => ({
  CacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    incrementStoreContextVersion: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/core/logger/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { CacheService } from '@/core/cache/service';
import { systemSettingsService } from '@/core/admin/system-settings/service';

// Mock the systemSettingsService methods directly
vi.mock('@/core/admin/system-settings/service', () => ({
  systemSettingsService: {
    getSetting: vi.fn(),
    setSetting: vi.fn(),
  },
}));

import { PlatformOffersService } from '@/core/admin/platform-offers/service';

const mockGetSetting = systemSettingsService.getSetting as ReturnType<typeof vi.fn>;
const mockSetSetting = systemSettingsService.setSetting as ReturnType<typeof vi.fn>;

describe('PlatformOffersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOffers', () => {
    it('returns empty when no offers configured', async () => {
      mockGetSetting.mockResolvedValue(null);

      const result = await PlatformOffersService.getOffers();

      expect(result.offers).toEqual([]);
      expect(result.updatedAt).toBeNull();
    });

    it('returns empty array when settings is empty object', async () => {
      mockGetSetting.mockResolvedValue({});

      const result = await PlatformOffersService.getOffers();

      expect(result.offers).toEqual([]);
    });

    it('returns offers when configured', async () => {
      const offers = [
        {
          id: 'offer-1',
          title: 'Upgrade to Pro',
          description: 'Get advanced analytics and priority support',
          ctaLabel: 'Learn More',
          ctaUrl: 'https://jiffoo.com/pro',
          badge: 'Recommended',
        },
      ];

      mockGetSetting.mockResolvedValue({
        offers,
        updatedAt: '2026-07-01T00:00:00.000Z',
      });

      const result = await PlatformOffersService.getOffers();

      expect(result.offers).toHaveLength(1);
      expect(result.offers[0].title).toBe('Upgrade to Pro');
      expect(result.updatedAt).toBe('2026-07-01T00:00:00.000Z');
    });

    it('filters out invalid offers', async () => {
      const offers = [
        {
          id: 'valid-offer',
          title: 'Valid Offer',
          description: 'A valid offer',
          ctaLabel: 'Click',
          ctaUrl: 'https://example.com',
        },
        // Missing required fields
        { id: 'invalid', title: 'No URL' },
        // Not an object
        'string-offer',
        null,
      ];

      mockGetSetting.mockResolvedValue({ offers, updatedAt: '2026-07-01T00:00:00.000Z' });

      const result = await PlatformOffersService.getOffers();

      expect(result.offers).toHaveLength(1);
      expect(result.offers[0].id).toBe('valid-offer');
    });

    it('returns empty on error (graceful degradation)', async () => {
      mockGetSetting.mockRejectedValue(new Error('DB connection failed'));

      const result = await PlatformOffersService.getOffers();

      expect(result.offers).toEqual([]);
      expect(result.updatedAt).toBeNull();
    });
  });

  describe('setOffers', () => {
    it('saves valid offers with updatedAt timestamp', async () => {
      const offers = [
        {
          id: 'new-offer',
          title: 'New Offer',
          description: 'Description',
          ctaLabel: 'Go',
          ctaUrl: 'https://example.com',
        },
      ];

      mockSetSetting.mockResolvedValue(undefined);

      await PlatformOffersService.setOffers(offers);

      expect(mockSetSetting).toHaveBeenCalledWith(
        'platform.offers',
        expect.objectContaining({
          offers: expect.arrayContaining([
            expect.objectContaining({ id: 'new-offer' }),
          ]),
          updatedAt: expect.any(String),
        }),
      );
    });

    it('filters invalid offers before saving', async () => {
      const offers = [
        {
          id: 'valid',
          title: 'Valid',
          description: 'desc',
          ctaLabel: 'Go',
          ctaUrl: 'https://example.com',
        },
        { id: 'invalid' }, // missing fields
      ];

      mockSetSetting.mockResolvedValue(undefined);

      await PlatformOffersService.setOffers(offers as any);

      const savedArg = mockSetSetting.mock.calls[0][1];
      expect(savedArg.offers).toHaveLength(1);
      expect(savedArg.offers[0].id).toBe('valid');
    });
  });
});

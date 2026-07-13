/**
 * Platform Offers Service
 *
 * Reads platform-managed offers from SystemSettings (default empty).
 * When JIFFOO_DISABLE_PLATFORM_OFFERS=true, always returns empty array.
 *
 * Offers are display-only cards (title, description, CTA link, icon) shown
 * in the Admin dashboard. They never inject code or modify store behavior.
 */

import { systemSettingsService } from '@/core/admin/system-settings/service';
import { logger } from '@/core/logger/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlatformOffer {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaUrl: string;
  icon?: string;
  badge?: string;
}

export interface PlatformOffersPayload {
  offers: PlatformOffer[];
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'platform.offers';
const DISABLED = process.env.JIFFOO_DISABLE_PLATFORM_OFFERS === 'true';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const PlatformOffersService = {
  /**
   * Get platform offers for display.
   * Returns empty array when disabled or no offers configured.
   */
  async getOffers(): Promise<PlatformOffersPayload> {
    if (DISABLED) {
      return { offers: [], updatedAt: null };
    }

    try {
      const raw = await systemSettingsService.getSetting(SETTINGS_KEY);

      if (!raw || typeof raw !== 'object') {
        return { offers: [], updatedAt: null };
      }

      const data = raw as { offers?: PlatformOffer[]; updatedAt?: string };
      const offers = Array.isArray(data.offers)
        ? data.offers.filter(isValidOffer)
        : [];

      return {
        offers,
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
      };
    } catch (err) {
      logger.warn({
        event: 'platform_offers_read_failed',
        error: err instanceof Error ? err.message : String(err),
      });
      return { offers: [], updatedAt: null };
    }
  },

  /**
   * Set platform offers (admin or platform-connection only).
   */
  async setOffers(offers: PlatformOffer[]): Promise<void> {
    const valid = offers.filter(isValidOffer);
    await systemSettingsService.setSetting(SETTINGS_KEY, {
      offers: valid,
      updatedAt: new Date().toISOString(),
    });
  },
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidOffer(value: unknown): value is PlatformOffer {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.title === 'string' &&
    typeof o.description === 'string' &&
    typeof o.ctaLabel === 'string' &&
    typeof o.ctaUrl === 'string'
  );
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/database', () => ({
  prisma: {
    recommendationConfig: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/core/logger/unified-logger', () => ({
  LoggerService: {
    log: vi.fn(),
  },
}));

vi.mock('@/core/recommendations/engines/personalized', () => ({
  PersonalizedRecommendationEngine: {
    getRecommendations: vi.fn(),
    getEmailRecommendations: vi.fn(),
  },
}));

vi.mock('@/core/recommendations/engines/collaborative-filtering', () => ({
  CollaborativeFilteringEngine: {
    getRecommendations: vi.fn(),
    computeAffinities: vi.fn(),
  },
}));

vi.mock('@/core/recommendations/engines/frequently-bought-together', () => ({
  FrequentlyBoughtTogetherEngine: {
    getRecommendations: vi.fn(),
  },
}));

import { prisma } from '@/config/database';
import { LoggerService } from '@/core/logger/unified-logger';
import { PersonalizedRecommendationEngine } from '@/core/recommendations/engines/personalized';
import { RecommendationService } from '@/core/recommendations/service';

describe('RecommendationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps personalized recommendations working when recommendation config table is missing', async () => {
    (prisma.recommendationConfig.findFirst as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('The table `public.recommendation_configs` does not exist in the current database.')
    );
    (PersonalizedRecommendationEngine.getRecommendations as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'prod_1', name: 'Sample Product' },
    ]);

    const result = await RecommendationService.getPersonalizedRecommendations({
      sessionId: 'session-1',
      limit: 4,
    });

    expect(result).toMatchObject({
      recommendationType: 'personalized',
      totalCount: 1,
      recommendations: [{ id: 'prod_1', name: 'Sample Product' }],
    });
    expect(LoggerService.log).toHaveBeenCalledWith(
      'warn',
      'Recommendation infrastructure unavailable; returning fallback result',
      expect.objectContaining({
        context: 'RecommendationService.getActiveConfig',
      })
    );
  });
});

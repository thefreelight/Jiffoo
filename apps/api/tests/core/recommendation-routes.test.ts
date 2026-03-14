import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPersonalizedRecommendations: vi.fn(),
}));

vi.mock('@/core/recommendations/service', () => ({
  RecommendationService: {
    getPersonalizedRecommendations: mocks.getPersonalizedRecommendations,
  },
}));

import { recommendationRoutes } from '@/core/recommendations/routes';

describe('recommendation route compatibility', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('serves the legacy personalized homepage alias with the same payload contract', async () => {
    const app = Fastify();
    mocks.getPersonalizedRecommendations.mockResolvedValue([{ id: 'sku_1' }]);

    await app.register(recommendationRoutes, { prefix: '/api/recommendations' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/recommendations/personalized/homepage?sessionId=session-1&limit=6&locale=zh-CN',
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.getPersonalizedRecommendations).toHaveBeenCalledWith({
      userId: undefined,
      sessionId: 'session-1',
      limit: 6,
      excludeProductIds: [],
      locale: 'zh-CN',
    });
    expect(response.json()).toMatchObject({
      success: true,
      data: [{ id: 'sku_1' }],
    });

    await app.close();
  });
});

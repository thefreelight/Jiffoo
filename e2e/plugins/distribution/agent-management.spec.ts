/**
 * Distribution Plugin E2E Tests
 * 
 * 这些测试只在分销插件启用时运行
 */

import { test, expect } from '@playwright/test';

// 检查分销插件是否启用
async function isDistributionEnabled(request: any): Promise<boolean> {
  try {
    const response = await request.get('/api/plugins/distribution/api/config');
    const data = await response.json();
    return data.success;
  } catch {
    return false;
  }
}

test.describe('Distribution Plugin Tests', () => {
  test.beforeEach(async ({ request }) => {
    const enabled = await isDistributionEnabled(request);
    test.skip(!enabled, 'Distribution plugin is not enabled');
  });

  test('should get plugin config', async ({ request }) => {
    const response = await request.get('/api/plugins/distribution/api/config');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('maxAgentLevel');
    expect(data.data).toHaveProperty('defaultCommissionRate');
  });

  test('should list agents', async ({ request }) => {
    const response = await request.get('/api/plugins/distribution/api/agents');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data?.agents)).toBe(true);
  });

  test('should list commissions', async ({ request }) => {
    const response = await request.get('/api/plugins/distribution/api/commissions');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data?.commissions)).toBe(true);
  });

  test('should list settlements', async ({ request }) => {
    const response = await request.get('/api/plugins/distribution/api/settlements');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data?.settlements)).toBe(true);
  });
});

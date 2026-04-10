/**
 * Multi-Tenant Plugin E2E Tests
 * 
 * 这些测试只在多租户插件启用时运行
 */

import { test, expect } from '@playwright/test';

// 检查多租户插件是否启用
async function isMultiTenantEnabled(request: any): Promise<boolean> {
  try {
    const response = await request.get('/api/plugins/multi-tenant/api/mode');
    const data = await response.json();
    return data.success && data.data?.mode === 'multi';
  } catch {
    return false;
  }
}

test.describe('Multi-Tenant Plugin Tests', () => {
  test.beforeEach(async ({ request }) => {
    const enabled = await isMultiTenantEnabled(request);
    test.skip(!enabled, 'Multi-tenant plugin is not enabled');
  });

  test('should list all tenants', async ({ request }) => {
    const response = await request.get('/api/plugins/multi-tenant/api/tenants');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data?.tenants)).toBe(true);
  });

  test('should get tenant mode', async ({ request }) => {
    const response = await request.get('/api/plugins/multi-tenant/api/mode');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(['single', 'multi']).toContain(data.data?.mode);
  });

  test('should not delete default tenant', async ({ request }) => {
    const response = await request.delete('/api/plugins/multi-tenant/api/tenants/1');
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.error).toBe('CANNOT_DELETE_DEFAULT_TENANT');
  });
});

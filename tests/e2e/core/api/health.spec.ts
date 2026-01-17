import { test, expect } from '@playwright/test';

/**
 * API 健康检查测试
 * 验证核心 API 服务是否正常运行
 */

test.describe('API Health Check', () => {
    test('should return 200 for health endpoint', async ({ request }) => {
        const response = await request.get('/health');
        expect(response.status()).toBe(200);

        const body = await response.json();
        expect(body).toHaveProperty('status');
        expect(body.status).toBe('ok');
    });

    test('should return API version info', async ({ request }) => {
        const response = await request.get('/api/v1/version');
        expect(response.ok()).toBeTruthy();
    });
});

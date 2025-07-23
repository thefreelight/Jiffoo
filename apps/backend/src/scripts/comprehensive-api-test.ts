/**
 * 全面的后端API测试脚本
 * 确保所有API端点都100%可用
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL';
  statusCode?: number;
  message?: string;
  responseTime?: number;
}

class ComprehensiveAPITester {
  private results: TestResult[] = [];

  async test(endpoint: string, method: string = 'GET', data?: any, headers?: any, expectedStatus: number = 200): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const config = {
        method,
        url: `${BASE_URL}${endpoint}`,
        data,
        headers,
        timeout: 10000,
        validateStatus: () => true
      };

      const response = await axios(config);
      const responseTime = Date.now() - startTime;

      const result: TestResult = {
        endpoint,
        method,
        status: response.status === expectedStatus ? 'PASS' : 'FAIL',
        statusCode: response.status,
        responseTime,
        message: response.status === expectedStatus ? 'OK' : `Expected ${expectedStatus}, got ${response.status}`
      };

      this.results.push(result);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const result: TestResult = {
        endpoint,
        method,
        status: 'FAIL',
        responseTime,
        message: (error as Error).message
      };

      this.results.push(result);
      return result;
    }
  }

  async runComprehensiveTests() {
    console.log('🔍 开始全面API测试...\n');

    // 1. 系统核心API
    console.log('🏠 系统核心API:');
    await this.test('/', 'GET');
    await this.test('/health', 'GET');
    await this.test('/docs', 'GET');
    await this.test('/openapi.json', 'GET');

    // 2. 商品管理API
    console.log('\n🛍️ 商品管理API:');
    await this.test('/api/products', 'GET');
    await this.test('/api/products?page=1&limit=5', 'GET');
    await this.test('/api/products/categories', 'GET');
    await this.test('/api/products/nonexistent', 'GET', undefined, undefined, 404);

    // 3. 搜索API
    console.log('\n🔍 搜索API:');
    await this.test('/api/search/products', 'GET');
    await this.test('/api/search/products?q=测试', 'GET');
    await this.test('/api/search/products?category=electronics', 'GET');

    // 4. 用户认证API
    console.log('\n👤 用户认证API:');
    await this.test('/api/auth/register', 'GET', undefined, undefined, 404);
    await this.test('/api/auth/login', 'GET', undefined, undefined, 404);
    await this.test('/api/auth/logout', 'GET', undefined, undefined, 404);

    // 5. 国际化API
    console.log('\n🌍 国际化API:');
    await this.test('/api/i18n/languages', 'GET');
    await this.test('/api/i18n/translations/zh-CN', 'GET');
    await this.test('/api/i18n/translations/en-US', 'GET');

    // 6. 插件系统API (需要认证)
    console.log('\n🔌 插件系统API:');
    await this.test('/api/plugins', 'GET', undefined, undefined, 401);
    await this.test('/api/plugins/available', 'GET', undefined, undefined, 401);
    await this.test('/api/plugins/stats', 'GET', undefined, undefined, 401);

    // 7. 插件商店API
    console.log('\n🏪 插件商店API:');
    await this.test('/api/plugin-store/plugins', 'GET');
    await this.test('/api/plugin-store/categories', 'GET');
    await this.test('/api/plugin-store/featured', 'GET');

    // 8. SaaS服务API
    console.log('\n☁️ SaaS服务API:');
    await this.test('/api/saas/plans', 'GET');
    await this.test('/api/saas/features', 'GET');

    // 9. 模板市场API
    console.log('\n🎨 模板市场API:');
    await this.test('/api/templates', 'GET');
    await this.test('/api/templates/categories', 'GET');
    await this.test('/api/templates/featured', 'GET');

    // 10. 许可证管理API (需要认证)
    console.log('\n🔐 许可证管理API:');
    await this.test('/api/licenses/validate?licenseKey=test&pluginName=test', 'GET', undefined, undefined, 400);
    await this.test('/api/licenses/generate', 'POST', {
      pluginName: 'test',
      licenseType: 'trial',
      features: ['feature1']
    }, undefined, 401);

    // 11. 统计分析API (需要认证)
    console.log('\n📊 统计分析API:');
    await this.test('/api/statistics/dashboard', 'GET', undefined, undefined, 401);
    await this.test('/api/statistics/sales', 'GET', undefined, undefined, 401);
    await this.test('/api/statistics/users', 'GET', undefined, undefined, 401);

    // 12. 库存管理API (需要认证)
    console.log('\n📦 库存管理API:');
    await this.test('/api/inventory/products', 'GET', undefined, undefined, 401);
    await this.test('/api/inventory/alerts', 'GET', undefined, undefined, 401);

    // 13. 通知系统API (需要认证)
    console.log('\n🔔 通知系统API:');
    await this.test('/api/notifications', 'GET', undefined, undefined, 401);
    await this.test('/api/notifications/templates', 'GET', undefined, undefined, 401);

    // 14. 销售管理API (需要认证)
    console.log('\n💰 销售管理API:');
    await this.test('/api/sales/orders', 'GET', undefined, undefined, 401);
    await this.test('/api/sales/reports', 'GET', undefined, undefined, 401);

    // 15. 租户管理API (需要认证)
    console.log('\n🏢 租户管理API:');
    await this.test('/api/tenants', 'GET', undefined, undefined, 401);
    await this.test('/api/tenants/current', 'GET', undefined, undefined, 401);

    // 16. 权限管理API (需要认证)
    console.log('\n🛡️ 权限管理API:');
    await this.test('/api/permissions/roles', 'GET', undefined, undefined, 401);
    await this.test('/api/permissions/check', 'GET', undefined, undefined, 401);

    // 17. 文件上传API (需要认证)
    console.log('\n📁 文件上传API:');
    await this.test('/api/upload/image', 'POST', {}, undefined, 401);

    // 18. 缓存管理API (需要认证)
    console.log('\n🗄️ 缓存管理API:');
    await this.test('/api/cache/stats', 'GET', undefined, undefined, 401);

    this.printResults();
  }

  printResults() {
    console.log('\n📊 全面测试结果汇总:');
    console.log('=' .repeat(100));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;

    this.results.forEach(result => {
      const statusIcon = result.status === 'PASS' ? '✅' : '❌';
      const responseTime = result.responseTime ? `${result.responseTime}ms` : 'N/A';
      console.log(`${statusIcon} ${result.method.padEnd(6)} ${result.endpoint.padEnd(50)} - ${result.statusCode} (${responseTime})`);
      if (result.message && result.status !== 'PASS') {
        console.log(`   💬 ${result.message}`);
      }
    });

    console.log('=' .repeat(100));
    console.log(`📈 总计: ${this.results.length} 个API端点测试`);
    console.log(`✅ 通过: ${passed}`);
    console.log(`❌ 失败: ${failed}`);
    console.log(`📊 成功率: ${((passed / this.results.length) * 100).toFixed(1)}%`);

    if (failed === 0) {
      console.log('\n🎉 所有API端点测试通过！后端系统100%可用！');
    } else {
      console.log('\n⚠️ 有API端点测试失败，请检查上述错误信息。');
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const tester = new ComprehensiveAPITester();
  tester.runComprehensiveTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 测试运行失败:', error);
      process.exit(1);
    });
}

export { ComprehensiveAPITester };

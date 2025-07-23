/**
 * 后端API全面测试脚本
 * 用于验证编译后的API是否正常工作
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  statusCode?: number;
  message?: string;
  responseTime?: number;
}

class APITester {
  private results: TestResult[] = [];

  async test(endpoint: string, method: string = 'GET', data?: any, headers?: any, expectedStatus: number = 200): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const config = {
        method,
        url: `${BASE_URL}${endpoint}`,
        data,
        headers,
        timeout: 5000,
        validateStatus: () => true // 不抛出错误，让我们手动检查状态码
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

  async runAllTests() {
    console.log('🧪 开始API测试...\n');

    // 1. 系统基础测试
    console.log('📋 系统基础测试:');
    await this.test('/', 'GET');
    await this.test('/health', 'GET');
    await this.test('/docs', 'GET');
    await this.test('/openapi.json', 'GET');

    // 2. 商品API测试
    console.log('\n🛍️ 商品API测试:');
    await this.test('/api/products', 'GET');
    await this.test('/api/products/nonexistent', 'GET', undefined, undefined, 404);

    // 3. 搜索API测试
    console.log('\n🔍 搜索API测试:');
    await this.test('/api/search/products?q=测试', 'GET');
    await this.test('/api/search/products', 'GET');

    // 4. 国际化API测试
    console.log('\n🌍 国际化API测试:');
    await this.test('/api/i18n/languages', 'GET');

    // 5. 插件商店API测试
    console.log('\n🔌 插件商店API测试:');
    await this.test('/api/plugin-store/plugins', 'GET');

    // 6. SaaS API测试
    console.log('\n☁️ SaaS API测试:');
    await this.test('/api/saas/plans', 'GET');

    // 7. 模板API测试
    console.log('\n🎨 模板API测试:');
    await this.test('/api/templates', 'GET');

    // 8. 需要认证的API测试（应该返回401）
    console.log('\n🔐 认证保护API测试:');
    await this.test('/api/plugins', 'GET', undefined, undefined, 401);
    await this.test('/api/statistics/dashboard', 'GET', undefined, undefined, 401);
    await this.test('/api/licenses/generate', 'POST', {
      pluginName: 'test',
      licenseType: 'trial',
      features: ['feature1']
    }, undefined, 401);

    // 9. 认证API测试
    console.log('\n👤 认证API测试:');
    await this.test('/api/auth/register', 'GET', undefined, undefined, 404); // GET应该404
    await this.test('/api/auth/login', 'GET', undefined, undefined, 404); // GET应该404

    this.printResults();
  }

  printResults() {
    console.log('\n📊 测试结果汇总:');
    console.log('=' .repeat(80));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;

    this.results.forEach(result => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      const responseTime = result.responseTime ? `${result.responseTime}ms` : 'N/A';
      console.log(`${statusIcon} ${result.method} ${result.endpoint} - ${result.statusCode} (${responseTime})`);
      if (result.message && result.status !== 'PASS') {
        console.log(`   💬 ${result.message}`);
      }
    });

    console.log('=' .repeat(80));
    console.log(`📈 总计: ${this.results.length} 个测试`);
    console.log(`✅ 通过: ${passed}`);
    console.log(`❌ 失败: ${failed}`);
    console.log(`⏭️ 跳过: ${skipped}`);
    console.log(`📊 成功率: ${((passed / this.results.length) * 100).toFixed(1)}%`);

    if (failed === 0) {
      console.log('\n🎉 所有测试通过！后端API运行正常！');
    } else {
      console.log('\n⚠️ 有测试失败，请检查上述错误信息。');
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const tester = new APITester();
  tester.runAllTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 测试运行失败:', error);
      process.exit(1);
    });
}

export { APITester };

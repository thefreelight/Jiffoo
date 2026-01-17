/**
 * Staging Environment Global Setup
 * 
 * 测试环境全局初始化脚本
 * 在所有测试运行前执行
 */

import { FullConfig } from '@playwright/test';
import {
  STAGING_TEST_USERS,
  STAGING_API_URLS,
  validateStagingAccounts,
} from './utils/staging-test-accounts';

async function globalSetup(config: FullConfig) {
  console.log('\n🚀 Staging E2E Test Setup');
  console.log('='.repeat(50));
  
  // 1. 检查测试环境是否可访问
  console.log('\n📡 Checking staging environment connectivity...');
  
  const services = [
    { name: 'Shop', url: 'http://jiffoo.chfastpay.com:30001' },
    { name: 'API', url: 'http://jiffoo.chfastpay.com:30002/health' },
    { name: 'Admin', url: 'http://jiffoo.chfastpay.com:30003' },
  ];
  
  for (const service of services) {
    try {
      const response = await fetch(service.url, { 
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      console.log(`  ✅ ${service.name}: ${response.status === 200 ? 'OK' : response.status}`);
    } catch (error) {
      console.log(`  ❌ ${service.name}: UNREACHABLE`);
      console.log(`     URL: ${service.url}`);
      console.log(`     Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
  
  // 2. 验证测试账号
  console.log('\n👤 Validating test accounts...');
  
  try {
    const { valid, results } = await validateStagingAccounts();
    
    for (const [key, result] of Object.entries(results)) {
      if (result.success) {
        console.log(`  ✅ ${key}: OK`);
      } else {
        console.log(`  ❌ ${key}: FAILED - ${result.error}`);
      }
    }
    
    if (!valid) {
      console.log('\n⚠️  Some test accounts are not available.');
      console.log('   Please run the seed script to create test accounts:');
      console.log('   pnpm --filter api db:seed:staging');
      console.log('\n   Or create accounts manually with these credentials:');
      
      for (const [key, user] of Object.entries(STAGING_TEST_USERS)) {
        console.log(`   - ${key}: ${user.email} / ${user.password}`);
      }
    }
  } catch (error) {
    console.log(`  ⚠️  Could not validate accounts: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
  
  // 3. 输出测试配置信息
  console.log('\n📋 Test Configuration:');
  console.log(`  - Projects: ${config.projects.map(p => p.name).join(', ')}`);
  console.log(`  - Workers: ${config.workers}`);
  console.log(`  - Retries: ${config.projects[0]?.retries || 0}`);
  console.log(`  - Timeout: ${config.projects[0]?.timeout || 30000}ms`);
  
  console.log('\n' + '='.repeat(50));
  console.log('🎬 Starting tests...\n');
}

export default globalSetup;

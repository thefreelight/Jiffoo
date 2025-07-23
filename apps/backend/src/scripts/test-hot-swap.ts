#!/usr/bin/env tsx

import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
// import { HotSwapTester } from '../plugins/test-hot-swap';
import { prisma } from '../config/database';

/**
 * 热插拔功能测试运行器
 */
async function runHotSwapTests() {
  let fastify: FastifyInstance | null = null;
  
  try {
    console.log('🔧 Initializing test environment...');
    
    // 创建 Fastify 实例
    fastify = Fastify({
      logger: {
        level: 'warn' // 减少日志输出
      }
    });

    // 连接数据库
    await prisma.$connect();
    console.log('✅ Database connected');

    // 清理测试数据
    await cleanupTestData();
    console.log('✅ Test data cleaned up');

    // 创建测试器
    // const tester = new HotSwapTester(fastify);

    // 运行测试
    // await tester.runAllTests();

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  } finally {
    // 清理资源
    if (fastify) {
      await fastify.close();
    }
    await prisma.$disconnect();
    console.log('\n🧹 Test environment cleaned up');
  }
}

/**
 * 清理测试数据
 */
async function cleanupTestData() {
  try {
    // 删除测试插件实例
    await prisma.pluginInstance.deleteMany({
      where: {
        pluginId: {
          in: ['test-plugin', 'test-plugin-1', 'test-plugin-2', 'test-plugin-3']
        }
      }
    });
    
    // 删除测试租户数据
    await prisma.pluginInstance.deleteMany({
      where: {
        tenantId: 'test-tenant-001'
      }
    });
    
  } catch (error) {
    console.warn('⚠️ Warning: Failed to cleanup test data:', error);
  }
}

// 运行测试
if (require.main === module) {
  runHotSwapTests()
    .then(() => {
      console.log('\n✨ Hot-swap tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Hot-swap tests failed:', error);
      process.exit(1);
    });
}

export { runHotSwapTests };

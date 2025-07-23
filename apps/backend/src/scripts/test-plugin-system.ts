/**
 * 插件系统测试脚本
 * 用于验证插件管理系统是否正常工作
 */

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { createUnifiedPluginManager } from '@/../../plugins/core/managers/unified-manager';
import { paymentManager } from '@/core/payment/payment-manager';

async function testPluginSystem() {
  console.log('🧪 开始测试插件系统...');

  try {
    // 模拟Fastify实例
    const mockFastify = {
      log: {
        info: console.log,
        warn: console.warn,
        error: console.error
      }
    } as any;

    // 创建Prisma客户端
    const prisma = new PrismaClient();

    // 初始化支付管理器
    await paymentManager.initialize(mockFastify);
    console.log('✅ 支付管理器初始化成功');

    // 获取统一插件管理器
    const unifiedManager = paymentManager.getUnifiedManager();
    console.log('✅ 获取统一插件管理器成功');

    // 测试获取可用插件
    const availablePlugins = unifiedManager.getAvailablePlugins();
    console.log(`✅ 可用插件数量: ${availablePlugins.length}`);
    
    if (availablePlugins.length > 0) {
      console.log('📋 可用插件列表:');
      availablePlugins.forEach((plugin: any) => {
        console.log(`  - ${plugin.metadata.displayName} (${plugin.metadata.id}) v${plugin.metadata.version}`);
      });
    }

    // 测试获取已安装插件
    const installedPlugins = await unifiedManager.getPlugins();
    console.log(`✅ 已安装插件数量: ${installedPlugins.length}`);

    // 测试获取活跃插件
    const activePlugins = unifiedManager.getActivePlugins();
    console.log(`✅ 活跃插件数量: ${activePlugins.length}`);

    // 测试插件系统健康状态
    if (installedPlugins.length > 0) {
      console.log('🔍 检查插件健康状态...');
      for (const plugin of installedPlugins) {
        try {
          const health = await unifiedManager.checkPluginHealth(plugin.metadata.id);
          console.log(`  - ${plugin.metadata.displayName}: ${health.isHealthy ? '✅ 健康' : '❌ 不健康'}`);
        } catch (error) {
          console.log(`  - ${plugin.metadata.displayName}: ❌ 健康检查失败`);
        }
      }
    }

    console.log('🎉 插件系统测试完成！');

  } catch (error) {
    console.error('❌ 插件系统测试失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testPluginSystem()
    .then(() => {
      console.log('✅ 测试成功完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 测试失败:', error);
      process.exit(1);
    });
}

export { testPluginSystem };

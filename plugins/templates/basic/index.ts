/**
 * 基础插件模板
 * 
 * 这是一个基础的插件模板，可以作为开发新插件的起点。
 * 请根据您的需求修改相应的部分。
 */

import {
  UnifiedPlugin,
  UnifiedPluginMetadata,
  PluginContext,
  PluginConfigSchema,
  PluginImplementation,
  PluginType,
  PluginLicenseType
} from '../../core/types';

// ==================== 插件元数据 ====================
// 请修改以下信息以匹配您的插件

const metadata: UnifiedPluginMetadata = {
  // 基本信息 - 必填
  id: 'your-plugin-id',                    // 插件唯一标识，建议使用 kebab-case
  name: 'your-plugin-name',                // 插件名称
  displayName: '您的插件显示名称',           // 用户界面显示的名称
  version: '1.0.0',                        // 插件版本，遵循语义化版本
  description: '插件的简短描述',             // 简短描述，一句话说明插件功能
  type: PluginType.CUSTOM,                 // 插件类型，根据实际情况选择
  
  // 详细信息 - 可选但推荐
  longDescription: `
    这里可以写插件的详细描述，包括：
    - 主要功能
    - 使用场景
    - 注意事项
    - 等等
  `,
  author: '您的名字或组织',                  // 作者信息
  homepage: 'https://your-website.com',    // 插件主页
  repository: 'https://github.com/your-repo', // 代码仓库
  keywords: ['keyword1', 'keyword2'],      // 关键词，便于搜索
  category: 'general',                     // 插件分类
  
  // 路由定义 - 如果插件需要提供API接口
  routes: [
    {
      method: 'GET',
      url: '/hello',
      handler: 'helloHandler',
      auth: false,                         // 是否需要认证
      schema: {                           // 请求/响应模式验证
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' }
            }
          }
        }
      }
    },
    {
      method: 'POST',
      url: '/process',
      handler: 'processHandler',
      auth: true,
      schema: {
        body: {
          type: 'object',
          required: ['data'],
          properties: {
            data: { type: 'string' }
          }
        }
      }
    }
  ],
  
  // 权限要求 - 插件需要的权限
  permissions: {
    api: ['basic.read', 'basic.write'],    // API权限
    database: ['your_table'],              // 数据库表访问权限
    network: ['api.example.com'],          // 网络访问权限
    system: []                             // 系统级权限
  },
  
  // 资源限制
  resources: {
    memory: 64,                           // 内存限制 (MB)
    cpu: 5,                              // CPU使用率限制 (%)
    storage: 10,                         // 存储空间限制 (MB)
    requests: 100                        // 每分钟请求数限制
  },
  
  // 依赖关系
  dependencies: [],                       // 依赖的其他插件
  peerDependencies: [],                   // 对等依赖
  conflicts: [],                          // 冲突的插件
  
  // 许可证信息
  license: {
    type: PluginLicenseType.MIT           // 许可证类型
  },
  
  // 定价信息
  pricing: {
    type: 'free'                         // 免费插件
  },
  
  // 兼容性
  minCoreVersion: '2.0.0',               // 最低核心版本要求
  supportedPlatforms: ['web', 'mobile']  // 支持的平台
};

// ==================== 配置模式 ====================
// 定义插件的配置选项

const configSchema: PluginConfigSchema = {
  type: 'object',
  properties: {
    // 示例配置项
    apiKey: {
      type: 'string',
      title: 'API密钥',
      description: '第三方服务的API密钥'
    },
    endpoint: {
      type: 'string',
      title: '服务端点',
      description: '第三方服务的API端点URL',
      default: 'https://api.example.com'
    },
    timeout: {
      type: 'number',
      title: '超时时间',
      description: '请求超时时间（毫秒）',
      default: 5000,
      minimum: 1000,
      maximum: 30000
    },
    enabled: {
      type: 'boolean',
      title: '启用状态',
      description: '是否启用此功能',
      default: true
    }
  },
  required: ['apiKey'],                   // 必填配置项
  additionalProperties: false             // 不允许额外属性
};

// ==================== 插件实现 ====================
// 实现插件的具体功能

class YourPluginImplementation implements PluginImplementation {
  private config: any;
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
    this.config = context.config;
  }

  async initialize(): Promise<void> {
    // 插件初始化逻辑
    this.context.logger.info('Your plugin is initializing...');
    
    // 验证配置
    if (!this.config.apiKey) {
      throw new Error('API密钥是必需的');
    }
    
    // 初始化第三方服务连接等
    // await this.connectToExternalService();
    
    this.context.logger.info('Your plugin initialized successfully');
  }

  async destroy(): Promise<void> {
    // 插件销毁逻辑
    this.context.logger.info('Your plugin is being destroyed...');
    
    // 清理资源，关闭连接等
    // await this.disconnectFromExternalService();
    
    this.context.logger.info('Your plugin destroyed successfully');
  }

  async healthCheck(): Promise<boolean> {
    try {
      // 健康检查逻辑
      // 例如：检查第三方服务连接状态
      return true;
    } catch (error) {
      this.context.logger.error('Health check failed:', error);
      return false;
    }
  }

  async validateConfig(config: any): Promise<boolean> {
    try {
      // 配置验证逻辑
      if (!config.apiKey || typeof config.apiKey !== 'string') {
        return false;
      }
      
      if (config.timeout && (config.timeout < 1000 || config.timeout > 30000)) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  // ==================== 路由处理器 ====================
  // 实现在 metadata.routes 中定义的处理器

  async helloHandler(request: any, reply: any): Promise<any> {
    return reply.send({
      message: 'Hello from your plugin!',
      timestamp: new Date().toISOString(),
      pluginId: metadata.id
    });
  }

  async processHandler(request: any, reply: any): Promise<any> {
    try {
      const { data } = request.body;
      
      // 处理业务逻辑
      const result = await this.processData(data);
      
      return reply.send({
        success: true,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.context.logger.error('Process handler error:', error);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ==================== 私有方法 ====================

  private async processData(data: string): Promise<any> {
    // 实现您的业务逻辑
    this.context.logger.info(`Processing data: ${data}`);
    
    // 示例：转换为大写
    return data.toUpperCase();
  }
}

// ==================== 插件定义 ====================

const yourPlugin: UnifiedPlugin = {
  metadata,

  async install(context: PluginContext): Promise<void> {
    context.logger.info('Installing your plugin...');
    
    // 安装逻辑
    // 例如：创建数据库表、初始化配置文件等
    
    context.logger.info('Your plugin installed successfully');
  },

  async activate(context: PluginContext): Promise<void> {
    context.logger.info('Activating your plugin...');
    
    // 创建插件实现实例
    const implementation = new YourPluginImplementation(context);
    await implementation.initialize();
    
    // 注册路由处理器
    if (metadata.routes) {
      for (const route of metadata.routes) {
        const handler = (implementation as any)[route.handler];
        if (handler) {
          // 将处理器绑定到正确的上下文
          context.app.addHook('onRoute', (routeOptions: any) => {
            if (routeOptions.url === `/api/plugins/${metadata.id}${route.url}`) {
              routeOptions.handler = handler.bind(implementation);
            }
          });
        }
      }
    }
    
    // 将实现实例存储到插件中
    (this as any).implementation = implementation;
    
    context.logger.info('Your plugin activated successfully');
  },

  async deactivate(context: PluginContext): Promise<void> {
    context.logger.info('Deactivating your plugin...');
    
    const implementation = (this as any).implementation;
    if (implementation) {
      await implementation.destroy();
    }
    
    context.logger.info('Your plugin deactivated successfully');
  },

  async uninstall(context: PluginContext): Promise<void> {
    context.logger.info('Uninstalling your plugin...');
    
    // 卸载逻辑
    // 例如：删除数据库表、清理配置文件等
    
    context.logger.info('Your plugin uninstalled successfully');
  },

  getConfigSchema(): PluginConfigSchema {
    return configSchema;
  },

  async validateConfig(config: any): Promise<boolean> {
    const implementation = new YourPluginImplementation({ config } as any);
    return implementation.validateConfig(config);
  },

  getDefaultConfig(): any {
    return {
      endpoint: 'https://api.example.com',
      timeout: 5000,
      enabled: true
    };
  },

  async healthCheck(): Promise<boolean> {
    const implementation = (this as any).implementation;
    return implementation ? implementation.healthCheck() : false;
  },

  implementation: null as any // 将在激活时设置
};

export default yourPlugin;

// ==================== 开发提示 ====================

/*
开发插件时的注意事项：

1. 插件ID必须唯一，建议使用 kebab-case 格式
2. 版本号遵循语义化版本规范 (semver)
3. 所有异步操作都应该正确处理错误
4. 使用 context.logger 进行日志记录
5. 配置验证要严格，防止无效配置导致问题
6. 健康检查应该快速执行，避免阻塞
7. 路由处理器要处理各种异常情况
8. 资源使用要合理，避免影响系统性能

测试插件：
1. 使用插件开发工具进行本地测试
2. 确保所有路由都能正常工作
3. 测试配置验证逻辑
4. 测试插件的安装、激活、停用、卸载流程
5. 进行压力测试，确保性能符合要求

发布插件：
1. 完善文档和示例
2. 添加适当的错误处理
3. 进行充分的测试
4. 遵循安全最佳实践
*/

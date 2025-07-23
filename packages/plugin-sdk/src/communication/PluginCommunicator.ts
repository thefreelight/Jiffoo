import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Logger } from '../utils/Logger';
import { PluginError } from '../types/PluginTypes';

/**
 * 插件通信器
 * 负责插件间的HTTP通信
 */
export class PluginCommunicator {
  private logger: Logger;
  private httpClient: AxiosInstance;
  private config: CommunicatorConfig;

  constructor(config: CommunicatorConfig) {
    this.logger = new Logger('PluginCommunicator');
    this.config = config;
    
    this.httpClient = axios.create({
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Jiffoo-Plugin-SDK/1.0.0'
      }
    });

    this.setupInterceptors();
  }

  /**
   * 调用其他插件的API
   */
  public async callPlugin<T = any>(
    pluginName: string,
    endpoint: string,
    options: CallOptions = {}
  ): Promise<T> {
    try {
      const url = this.buildPluginUrl(pluginName, endpoint);
      const requestConfig: AxiosRequestConfig = {
        method: options.method || 'GET',
        url,
        data: options.data,
        params: options.params,
        headers: {
          ...options.headers,
          'X-Plugin-Source': this.config.pluginName,
          'X-Correlation-ID': options.correlationId || this.generateCorrelationId()
        }
      };

      this.logger.debug(`Calling plugin API: ${pluginName}${endpoint}`, requestConfig);
      
      const response = await this.httpClient.request(requestConfig);
      
      this.logger.debug(`Plugin API call successful: ${pluginName}${endpoint}`, {
        status: response.status,
        data: response.data
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Plugin API call failed: ${pluginName}${endpoint}`, error);
      throw this.handleApiError(error, pluginName, endpoint);
    }
  }

  /**
   * 发送事件到其他插件
   */
  public async sendEvent(
    pluginName: string,
    eventType: string,
    eventData: any,
    options: EventOptions = {}
  ): Promise<void> {
    try {
      await this.callPlugin(pluginName, '/events', {
        method: 'POST',
        data: {
          type: eventType,
          data: eventData,
          source: this.config.pluginName,
          timestamp: new Date().toISOString(),
          correlationId: options.correlationId
        },
        headers: options.headers
      });

      this.logger.info(`Event sent to plugin: ${pluginName}`, {
        eventType,
        eventData
      });
    } catch (error) {
      this.logger.error(`Failed to send event to plugin: ${pluginName}`, error);
      throw new PluginError(
        `Event send failed: ${pluginName}`,
        'EVENT_SEND_ERROR',
        500,
        error
      );
    }
  }

  /**
   * 广播事件到所有插件
   */
  public async broadcastEvent(
    eventType: string,
    eventData: any,
    options: BroadcastOptions = {}
  ): Promise<void> {
    try {
      const plugins = options.targetPlugins || await this.getAvailablePlugins();
      const promises = plugins.map(plugin => 
        this.sendEvent(plugin, eventType, eventData, options)
          .catch(error => {
            this.logger.warn(`Failed to send event to plugin: ${plugin}`, error);
            return null; // 不让单个插件的失败影响整个广播
          })
      );

      await Promise.allSettled(promises);
      
      this.logger.info(`Event broadcasted to ${plugins.length} plugins`, {
        eventType,
        eventData,
        targetPlugins: plugins
      });
    } catch (error) {
      this.logger.error('Failed to broadcast event', error);
      throw new PluginError(
        'Event broadcast failed',
        'EVENT_BROADCAST_ERROR',
        500,
        error
      );
    }
  }

  /**
   * 获取插件健康状态
   */
  public async getPluginHealth(pluginName: string): Promise<PluginHealthResponse> {
    try {
      const health = await this.callPlugin<PluginHealthResponse>(
        pluginName,
        '/health'
      );
      
      return health;
    } catch (error) {
      this.logger.error(`Failed to get plugin health: ${pluginName}`, error);
      return {
        status: 'unhealthy',
        message: 'Plugin unreachable',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 获取插件信息
   */
  public async getPluginInfo(pluginName: string): Promise<PluginInfoResponse> {
    try {
      return await this.callPlugin<PluginInfoResponse>(
        pluginName,
        '/info'
      );
    } catch (error) {
      this.logger.error(`Failed to get plugin info: ${pluginName}`, error);
      throw new PluginError(
        `Plugin info retrieval failed: ${pluginName}`,
        'PLUGIN_INFO_ERROR',
        500,
        error
      );
    }
  }

  /**
   * 设置请求拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug('HTTP request', {
          method: config.method,
          url: config.url,
          headers: config.headers
        });
        return config;
      },
      (error) => {
        this.logger.error('HTTP request error', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug('HTTP response', {
          status: response.status,
          url: response.config.url,
          data: response.data
        });
        return response;
      },
      (error) => {
        this.logger.error('HTTP response error', {
          status: error.response?.status,
          url: error.config?.url,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * 构建插件URL
   */
  private buildPluginUrl(pluginName: string, endpoint: string): string {
    const baseUrl = this.config.serviceDiscovery?.getPluginUrl?.(pluginName) ||
                   `http://plugin-${pluginName}.${this.config.namespace || 'jiffoo-plugins'}.svc.cluster.local`;
    
    return `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  }

  /**
   * 处理API错误
   */
  private handleApiError(error: any, pluginName: string, endpoint: string): PluginError {
    if (error.response) {
      // 服务器响应了错误状态码
      return new PluginError(
        `Plugin API error: ${pluginName}${endpoint} - ${error.response.status}`,
        'PLUGIN_API_ERROR',
        error.response.status,
        error.response.data
      );
    } else if (error.request) {
      // 请求发出但没有收到响应
      return new PluginError(
        `Plugin unreachable: ${pluginName}${endpoint}`,
        'PLUGIN_UNREACHABLE',
        503,
        error.message
      );
    } else {
      // 其他错误
      return new PluginError(
        `Plugin communication error: ${pluginName}${endpoint}`,
        'PLUGIN_COMM_ERROR',
        500,
        error.message
      );
    }
  }

  /**
   * 获取可用插件列表
   */
  private async getAvailablePlugins(): Promise<string[]> {
    // TODO: 从服务发现或注册表获取插件列表
    return this.config.knownPlugins || [];
  }

  /**
   * 生成关联ID
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 通信器配置接口
export interface CommunicatorConfig {
  pluginName: string;
  namespace?: string;
  timeout?: number;
  knownPlugins?: string[];
  serviceDiscovery?: {
    getPluginUrl: (pluginName: string) => string;
  };
}

// 调用选项接口
export interface CallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  params?: any;
  headers?: Record<string, string>;
  correlationId?: string;
}

// 事件选项接口
export interface EventOptions {
  correlationId?: string;
  headers?: Record<string, string>;
}

// 广播选项接口
export interface BroadcastOptions extends EventOptions {
  targetPlugins?: string[];
}

// 插件健康响应接口
export interface PluginHealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  timestamp: string;
  details?: any;
}

// 插件信息响应接口
export interface PluginInfoResponse {
  name: string;
  version: string;
  description: string;
  status: string;
  uptime: number;
  metadata: any;
}

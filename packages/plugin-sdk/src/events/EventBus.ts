import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger';
import { PluginError } from '../types/PluginTypes';

/**
 * 事件总线
 * 负责插件间的事件通信
 */
export class EventBus {
  private emitter: EventEmitter;
  private logger: Logger;
  private config: EventBusConfig;
  private connected: boolean = false;

  constructor(config: EventBusConfig) {
    this.logger = new Logger('EventBus');
    this.config = config;
    this.emitter = new EventEmitter();
    
    // 设置最大监听器数量
    this.emitter.setMaxListeners(1000);
  }

  /**
   * 初始化事件总线
   */
  public async initialize(): Promise<void> {
    try {
      // 根据配置初始化不同的事件代理
      switch (this.config.broker) {
        case 'redis':
          await this.initializeRedisEventBus();
          break;
        case 'rabbitmq':
          await this.initializeRabbitMQEventBus();
          break;
        case 'kafka':
          await this.initializeKafkaEventBus();
          break;
        default:
          // 使用内存事件总线
          await this.initializeMemoryEventBus();
      }
      
      this.connected = true;
      this.logger.info('Event bus initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize event bus', error);
      throw new PluginError('Event bus initialization failed', 'EVENT_BUS_INIT_ERROR', 500, error);
    }
  }

  /**
   * 断开事件总线
   */
  public async disconnect(): Promise<void> {
    try {
      this.emitter.removeAllListeners();
      this.connected = false;
      this.logger.info('Event bus disconnected');
    } catch (error) {
      this.logger.error('Failed to disconnect event bus', error);
      throw new PluginError('Event bus disconnection failed', 'EVENT_BUS_DISCONNECT_ERROR', 500, error);
    }
  }

  /**
   * 发布事件
   */
  public async publish(event: string, data: any, options?: PublishOptions): Promise<void> {
    try {
      const eventData = {
        event,
        data,
        timestamp: new Date(),
        source: options?.source || 'unknown',
        correlationId: options?.correlationId || this.generateCorrelationId()
      };

      this.emitter.emit(event, eventData);
      this.logger.debug(`Event published: ${event}`, eventData);
    } catch (error) {
      this.logger.error(`Failed to publish event: ${event}`, error);
      throw new PluginError(`Event publish failed: ${event}`, 'EVENT_PUBLISH_ERROR', 500, error);
    }
  }

  /**
   * 订阅事件
   */
  public subscribe(event: string, handler: EventHandler): void {
    try {
      this.emitter.on(event, handler);
      this.logger.debug(`Subscribed to event: ${event}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to event: ${event}`, error);
      throw new PluginError(`Event subscription failed: ${event}`, 'EVENT_SUBSCRIBE_ERROR', 500, error);
    }
  }

  /**
   * 取消订阅事件
   */
  public unsubscribe(event: string, handler?: EventHandler): void {
    try {
      if (handler) {
        this.emitter.off(event, handler);
      } else {
        this.emitter.removeAllListeners(event);
      }
      this.logger.debug(`Unsubscribed from event: ${event}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from event: ${event}`, error);
      throw new PluginError(`Event unsubscription failed: ${event}`, 'EVENT_UNSUBSCRIBE_ERROR', 500, error);
    }
  }

  /**
   * 一次性订阅事件
   */
  public once(event: string, handler: EventHandler): void {
    try {
      this.emitter.once(event, handler);
      this.logger.debug(`One-time subscription to event: ${event}`);
    } catch (error) {
      this.logger.error(`Failed to create one-time subscription: ${event}`, error);
      throw new PluginError(`Event once subscription failed: ${event}`, 'EVENT_ONCE_ERROR', 500, error);
    }
  }

  /**
   * 获取事件监听器数量
   */
  public getListenerCount(event: string): number {
    return this.emitter.listenerCount(event);
  }

  /**
   * 获取所有事件名称
   */
  public getEventNames(): string[] {
    return this.emitter.eventNames().map(name => name.toString());
  }

  /**
   * 检查是否连接
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * 初始化内存事件总线
   */
  private async initializeMemoryEventBus(): Promise<void> {
    // 内存事件总线不需要额外初始化
    this.logger.info('Using in-memory event bus');
  }

  /**
   * 初始化Redis事件总线
   */
  private async initializeRedisEventBus(): Promise<void> {
    // TODO: 实现Redis事件总线
    this.logger.info('Redis event bus not implemented yet, using memory event bus');
  }

  /**
   * 初始化RabbitMQ事件总线
   */
  private async initializeRabbitMQEventBus(): Promise<void> {
    // TODO: 实现RabbitMQ事件总线
    this.logger.info('RabbitMQ event bus not implemented yet, using memory event bus');
  }

  /**
   * 初始化Kafka事件总线
   */
  private async initializeKafkaEventBus(): Promise<void> {
    // TODO: 实现Kafka事件总线
    this.logger.info('Kafka event bus not implemented yet, using memory event bus');
  }

  /**
   * 生成关联ID
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 事件总线配置接口
export interface EventBusConfig {
  broker: 'redis' | 'rabbitmq' | 'kafka' | 'memory';
  connection: any;
  topics?: string[];
}

// 发布选项接口
export interface PublishOptions {
  source?: string;
  correlationId?: string;
  persistent?: boolean;
  ttl?: number;
}

// 事件处理器类型
export type EventHandler = (eventData: any) => void | Promise<void>;

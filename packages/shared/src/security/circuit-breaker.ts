/**
 * Circuit Breaker - 熔断器模式实现
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  /** 失败阈值（触发熔断） */
  failureThreshold: number;
  /** 成功阈值（半开状态恢复） */
  successThreshold: number;
  /** 熔断超时时间（毫秒） */
  timeout: number;
  /** 监控窗口（毫秒） */
  monitoringWindow?: number;
  /** 错误过滤器 */
  errorFilter?: (error: Error) => boolean;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

type CircuitBreakerEventType = 'stateChange' | 'success' | 'failure' | 'rejected';

/**
 * Circuit Breaker 类
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: number;
  private nextAttemptTime?: number;
  private config: Required<CircuitBreakerConfig>;
  private listeners = new Map<CircuitBreakerEventType, Set<(data: unknown) => void>>();

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: config.failureThreshold,
      successThreshold: config.successThreshold,
      timeout: config.timeout,
      monitoringWindow: config.monitoringWindow ?? 60000,
      errorFilter: config.errorFilter ?? (() => true),
    };
  }

  /**
   * 执行受保护的函数
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      this.emit('rejected', { state: this.state });
      throw new CircuitBreakerError('Circuit breaker is OPEN', this.state);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      if (error instanceof Error && this.config.errorFilter(error)) {
        this.onFailure();
      }
      throw error;
    }
  }

  /**
   * 检查是否可以执行
   */
  canExecute(): boolean {
    if (this.state === CircuitState.CLOSED) return true;
    if (this.state === CircuitState.OPEN) {
      if (this.nextAttemptTime && Date.now() >= this.nextAttemptTime) {
        this.transitionTo(CircuitState.HALF_OPEN);
        return true;
      }
      return false;
    }
    // HALF_OPEN - 允许一个请求通过
    return true;
  }

  private onSuccess(): void {
    this.emit('success', { state: this.state });
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      // 成功时重置失败计数
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.emit('failure', { state: this.state });

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state === CircuitState.CLOSED) {
      this.failures++;
      if (this.failures >= this.config.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitState.OPEN) {
      this.nextAttemptTime = Date.now() + this.config.timeout;
      this.successes = 0;
    } else if (newState === CircuitState.CLOSED) {
      this.failures = 0;
      this.successes = 0;
      this.nextAttemptTime = undefined;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successes = 0;
    }

    this.emit('stateChange', { from: oldState, to: newState });
  }

  /**
   * 获取当前状态
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 获取统计信息
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  /**
   * 强制打开熔断器
   */
  open(): void {
    this.transitionTo(CircuitState.OPEN);
  }

  /**
   * 强制关闭熔断器
   */
  close(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * 重置熔断器
   */
  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
    this.transitionTo(CircuitState.CLOSED);
  }

  on(event: CircuitBreakerEventType, listener: (data: unknown) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  }

  off(event: CircuitBreakerEventType, listener: (data: unknown) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(event: CircuitBreakerEventType, data: unknown): void {
    this.listeners.get(event)?.forEach((listener) => listener(data));
  }
}

export class CircuitBreakerError extends Error {
  constructor(message: string, public readonly state: CircuitState) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}


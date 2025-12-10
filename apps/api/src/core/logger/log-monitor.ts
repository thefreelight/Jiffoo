/**
 * 日志监控和告警服务
 */

import { EventEmitter } from 'events';
import { logAggregator, LogStats } from './log-aggregator';
import { logger } from './unified-logger';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  cooldownMinutes: number;
  lastTriggered?: Date;
}

export interface AlertCondition {
  type: 'error_rate' | 'error_count' | 'log_volume' | 'response_time' | 'custom';
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  threshold: number;
  timeWindow: string; // '5m', '15m', '1h', etc.
  appName?: string;
  level?: string;
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'log' | 'console';
  config: {
    recipients?: string[];
    webhookUrl?: string;
    message?: string;
  };
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  conditions: AlertCondition[];
  data: any;
  resolved: boolean;
  resolvedAt?: Date;
}

/**
 * 日志监控器类
 */
export class LogMonitor extends EventEmitter {
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    super();
    this.setupDefaultRules();
  }

  /**
   * 启动监控
   */
  start(intervalMs: number = 60000): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.monitoringInterval = setInterval(() => {
      this.checkAllRules();
    }, intervalMs);

    logger.info('Log monitoring started', {
      type: 'monitor_lifecycle',
      event: 'started',
      intervalMs
    });
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isRunning = false;

    logger.info('Log monitoring stopped', {
      type: 'monitor_lifecycle',
      event: 'stopped'
    });
  }

  /**
   * 添加告警规则
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    
    logger.info('Alert rule added', {
      type: 'alert_rule_management',
      action: 'added',
      ruleId: rule.id,
      ruleName: rule.name
    });
  }

  /**
   * 移除告警规则
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    
    logger.info('Alert rule removed', {
      type: 'alert_rule_management',
      action: 'removed',
      ruleId
    });
  }

  /**
   * 获取所有规则
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * 获取所有告警
   */
  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * 解决告警
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      
      logger.info('Alert resolved', {
        type: 'alert_management',
        action: 'resolved',
        alertId,
        ruleName: alert.ruleName
      });
    }
  }

  /**
   * 检查所有规则
   */
  private async checkAllRules(): Promise<void> {
    for (const rule of this.rules.values()) {
      if (rule.enabled) {
        await this.checkRule(rule);
      }
    }
  }

  /**
   * 检查单个规则
   */
  private async checkRule(rule: AlertRule): Promise<void> {
    try {
      // 检查冷却时间
      if (rule.lastTriggered) {
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;
        const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
        if (timeSinceLastTrigger < cooldownMs) {
          return;
        }
      }

      // 检查所有条件
      const conditionResults = await Promise.all(
        rule.conditions.map(condition => this.checkCondition(condition))
      );

      // 如果所有条件都满足，触发告警
      if (conditionResults.every(result => result.triggered)) {
        await this.triggerAlert(rule, conditionResults);
      }
    } catch (error) {
      logger.error('Error checking alert rule', {
        type: 'monitor_error',
        ruleId: rule.id,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 检查单个条件
   */
  private async checkCondition(condition: AlertCondition): Promise<{ triggered: boolean; value: number; data: any }> {
    const timeRange = condition.timeWindow;
    const stats = await logAggregator.getLogStats(timeRange);

    let value: number;
    let data: any = stats;

    switch (condition.type) {
      case 'error_count':
        value = stats.errorLogs;
        break;
      case 'error_rate':
        value = stats.totalLogs > 0 ? (stats.errorLogs / stats.totalLogs) * 100 : 0;
        break;
      case 'log_volume':
        value = stats.totalLogs;
        break;
      default:
        value = 0;
    }

    const triggered = this.evaluateCondition(value, condition.operator, condition.threshold);

    return { triggered, value, data };
  }

  /**
   * 评估条件
   */
  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  /**
   * 触发告警
   */
  private async triggerAlert(rule: AlertRule, conditionResults: any[]): Promise<void> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      message: this.generateAlertMessage(rule, conditionResults),
      severity: this.determineSeverity(rule, conditionResults),
      timestamp: new Date(),
      conditions: rule.conditions,
      data: conditionResults,
      resolved: false
    };

    this.alerts.set(alert.id, alert);
    rule.lastTriggered = new Date();

    // 执行告警动作
    for (const action of rule.actions) {
      await this.executeAction(action, alert);
    }

    // 发出事件
    this.emit('alert', alert);

    logger.warn('Alert triggered', {
      type: 'alert_triggered',
      alertId: alert.id,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: alert.severity,
      message: alert.message
    });
  }

  /**
   * 生成告警消息
   */
  private generateAlertMessage(rule: AlertRule, conditionResults: any[]): string {
    const conditions = rule.conditions.map((condition, index) => {
      const result = conditionResults[index];
      return `${condition.type} ${condition.operator} ${condition.threshold} (current: ${result.value})`;
    }).join(' AND ');

    return `${rule.name}: ${conditions}`;
  }

  /**
   * 确定告警严重程度
   */
  private determineSeverity(rule: AlertRule, conditionResults: any[]): 'low' | 'medium' | 'high' | 'critical' {
    // 简单的严重程度判断逻辑
    const hasErrorCondition = rule.conditions.some(c => c.type === 'error_rate' || c.type === 'error_count');
    const maxValue = Math.max(...conditionResults.map(r => r.value));

    if (hasErrorCondition && maxValue > 100) {
      return 'critical';
    } else if (hasErrorCondition && maxValue > 50) {
      return 'high';
    } else if (maxValue > 10) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 执行告警动作
   */
  private async executeAction(action: AlertAction, alert: Alert): Promise<void> {
    try {
      switch (action.type) {
        case 'log':
          logger.error('ALERT: ' + alert.message, {
            type: 'alert_action',
            alertId: alert.id,
            severity: alert.severity
          });
          break;

        case 'console':
          console.error(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);
          break;

        case 'webhook':
          if (action.config.webhookUrl) {
            await this.sendWebhook(action.config.webhookUrl, alert);
          }
          break;

        case 'email':
          // 这里可以集成邮件发送服务
          logger.info('Email alert would be sent', {
            type: 'alert_action',
            action: 'email',
            recipients: action.config.recipients,
            alertId: alert.id
          });
          break;
      }
    } catch (error) {
      logger.error('Failed to execute alert action', {
        type: 'alert_action_error',
        action: action.type,
        alertId: alert.id,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 发送 Webhook
   */
  private async sendWebhook(url: string, alert: Alert): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          alert,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Webhook error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 发送飞书通知
   */
  async sendFeishuAlert(alert: Alert, webhookUrl?: string): Promise<void> {
    const url = webhookUrl || process.env.FEISHU_WEBHOOK_URL;
    if (!url) {
      logger.warn('Feishu webhook URL not configured', { alertId: alert.id });
      return;
    }

    const severityEmoji = {
      low: '💡',
      medium: '⚠️',
      high: '🔶',
      critical: '🔴'
    };

    const message = {
      msg_type: 'interactive',
      card: {
        header: {
          title: {
            tag: 'plain_text',
            content: `${severityEmoji[alert.severity]} 日志告警 - ${alert.ruleName}`
          },
          template: alert.severity === 'critical' ? 'red' : alert.severity === 'high' ? 'orange' : 'yellow'
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `**告警消息**: ${alert.message}`
            }
          },
          {
            tag: 'div',
            fields: [
              { is_short: true, text: { tag: 'lark_md', content: `**严重程度**: ${alert.severity}` } },
              { is_short: true, text: { tag: 'lark_md', content: `**触发时间**: ${alert.timestamp.toISOString()}` } }
            ]
          },
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `**告警ID**: ${alert.id}`
            }
          }
        ]
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`Feishu notification failed: ${response.status}`);
      }

      logger.info('Feishu alert sent', { alertId: alert.id, severity: alert.severity });
    } catch (err) {
      logger.error(new Error('Failed to send Feishu alert'), {
        alertId: alert.id,
        originalError: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  /**
   * 获取监控仪表盘数据
   */
  async getDashboardData(): Promise<{
    activeAlerts: Alert[];
    recentAlerts: Alert[];
    stats: {
      totalAlerts: number;
      unresolvedAlerts: number;
      alertsBySeverity: Record<string, number>;
      alertsByRule: Record<string, number>;
    };
    rules: {
      total: number;
      enabled: number;
      disabled: number;
    };
  }> {
    const allAlerts = this.getAllAlerts();
    const activeAlerts = this.getActiveAlerts();

    // 最近24小时的告警
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAlerts = allAlerts.filter(a => a.timestamp > oneDayAgo);

    // 按严重程度统计
    const alertsBySeverity: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const alert of allAlerts) {
      alertsBySeverity[alert.severity]++;
    }

    // 按规则统计
    const alertsByRule: Record<string, number> = {};
    for (const alert of allAlerts) {
      alertsByRule[alert.ruleName] = (alertsByRule[alert.ruleName] || 0) + 1;
    }

    // 规则统计
    const rules = this.getRules();
    const enabledRules = rules.filter(r => r.enabled).length;

    return {
      activeAlerts,
      recentAlerts: recentAlerts.slice(0, 20), // 最近20条
      stats: {
        totalAlerts: allAlerts.length,
        unresolvedAlerts: activeAlerts.length,
        alertsBySeverity,
        alertsByRule
      },
      rules: {
        total: rules.length,
        enabled: enabledRules,
        disabled: rules.length - enabledRules
      }
    };
  }

  /**
   * 设置默认规则
   */
  private setupDefaultRules(): void {
    // 高错误率告警
    this.addRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      description: 'Triggers when error rate exceeds 5% in 15 minutes',
      enabled: true,
      cooldownMinutes: 15,
      conditions: [{
        type: 'error_rate',
        operator: 'gt',
        threshold: 5,
        timeWindow: '15m'
      }],
      actions: [{
        type: 'log',
        config: { message: 'High error rate detected' }
      }]
    });

    // 大量错误告警
    this.addRule({
      id: 'high_error_count',
      name: 'High Error Count',
      description: 'Triggers when error count exceeds 50 in 5 minutes',
      enabled: true,
      cooldownMinutes: 10,
      conditions: [{
        type: 'error_count',
        operator: 'gt',
        threshold: 50,
        timeWindow: '5m'
      }],
      actions: [{
        type: 'log',
        config: { message: 'High error count detected' }
      }]
    });

    // 日志量异常告警
    this.addRule({
      id: 'abnormal_log_volume',
      name: 'Abnormal Log Volume',
      description: 'Triggers when log volume exceeds 10000 in 1 hour',
      enabled: true,
      cooldownMinutes: 30,
      conditions: [{
        type: 'log_volume',
        operator: 'gt',
        threshold: 10000,
        timeWindow: '1h'
      }],
      actions: [{
        type: 'log',
        config: { message: 'Abnormal log volume detected' }
      }]
    });
  }
}

// 导出单例实例
export const logMonitor = new LogMonitor();
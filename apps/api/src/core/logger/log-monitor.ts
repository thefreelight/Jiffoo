/**
 * Log monitoring and alert service
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
 * LogMonitor class
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
   * Start monitoring
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
   * Stop monitoring
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
   * Add alert rule
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
   * Remove alert rule
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
   * Get all rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Resolve alert
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
   * Check all rules
   */
  private async checkAllRules(): Promise<void> {
    for (const rule of this.rules.values()) {
      if (rule.enabled) {
        await this.checkRule(rule);
      }
    }
  }

  /**
   * Check single rule
   */
  private async checkRule(rule: AlertRule): Promise<void> {
    try {
      // Check cooldown time
      if (rule.lastTriggered) {
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;
        const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
        if (timeSinceLastTrigger < cooldownMs) {
          return;
        }
      }

      // Check all conditions
      const conditionResults = await Promise.all(
        rule.conditions.map(condition => this.checkCondition(condition))
      );

      // If all conditions are met, trigger alert
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
   * Check single condition
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
   * Evaluate condition
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
   * Trigger alert
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

    // Execute alert actions
    for (const action of rule.actions) {
      await this.executeAction(action, alert);
    }

    // Emit event
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
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule, conditionResults: any[]): string {
    const conditions = rule.conditions.map((condition, index) => {
      const result = conditionResults[index];
      return `${condition.type} ${condition.operator} ${condition.threshold} (current: ${result.value})`;
    }).join(' AND ');

    return `${rule.name}: ${conditions}`;
  }

  /**
   * Determine alert severity
   */
  private determineSeverity(rule: AlertRule, conditionResults: any[]): 'low' | 'medium' | 'high' | 'critical' {
    // Simple severity judgment logic
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
   * Execute alert action
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
          // Integrate email service here
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
   * Send Webhook
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
   * Send Feishu (Lark) notification
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
            content: `${severityEmoji[alert.severity]} Log Alert - ${alert.ruleName}`
          },
          template: alert.severity === 'critical' ? 'red' : alert.severity === 'high' ? 'orange' : 'yellow'
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `**Alert Message**: ${alert.message}`
            }
          },
          {
            tag: 'div',
            fields: [
              { is_short: true, text: { tag: 'lark_md', content: `**Severity**: ${alert.severity}` } },
              { is_short: true, text: { tag: 'lark_md', content: `**Trigger Time**: ${alert.timestamp.toISOString()}` } }
            ]
          },
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `**Alert ID**: ${alert.id}`
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
   * Get monitor dashboard data
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

    // Alerts in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAlerts = allAlerts.filter(a => a.timestamp > oneDayAgo);

    // Stats by severity
    const alertsBySeverity: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const alert of allAlerts) {
      alertsBySeverity[alert.severity]++;
    }

    // Stats by rule
    const alertsByRule: Record<string, number> = {};
    for (const alert of allAlerts) {
      alertsByRule[alert.ruleName] = (alertsByRule[alert.ruleName] || 0) + 1;
    }

    // Rule stats
    const rules = this.getRules();
    const enabledRules = rules.filter(r => r.enabled).length;

    return {
      activeAlerts,
      recentAlerts: recentAlerts.slice(0, 20), // Recent 20 items
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
   * Set default rules
   */
  private setupDefaultRules(): void {
    // High error rate alert
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

    // High error count alert
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

    // Abnormal log volume alert
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

// Export singleton instance
export const logMonitor = new LogMonitor();
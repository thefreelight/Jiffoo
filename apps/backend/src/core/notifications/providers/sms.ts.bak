import { Notification } from '../types';
import { LoggerService } from '@/core/logger/logger';
import { env } from '@/config/env';

export class SMSProvider {
  /**
   * 发送短信
   */
  static async send(notification: Notification): Promise<boolean> {
    try {
      // 开发环境模拟发送
      if (env.NODE_ENV === 'development') {
        LoggerService.logSystem('SMS sent (simulated)', {
          notificationId: notification.id,
          recipient: notification.recipient,
          content: notification.content
        });
        
        console.log('📱 SMS (Simulated):');
        console.log(`To: ${notification.recipient}`);
        console.log(`Content: ${notification.content}`);
        
        return true;
      }

      // 生产环境需要配置真实的SMS服务
      // 这里可以集成 Twilio、阿里云短信、腾讯云短信等
      
      // TODO: 实现真实的SMS发送逻辑
      // 示例：使用 Twilio
      /*
      const twilio = require('twilio');
      const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
      
      const message = await client.messages.create({
        body: notification.content,
        from: env.TWILIO_PHONE_NUMBER,
        to: notification.recipient
      });
      
      LoggerService.logSystem('SMS sent via Twilio', {
        notificationId: notification.id,
        recipient: notification.recipient,
        messageSid: message.sid
      });
      
      return true;
      */

      LoggerService.logSystem('SMS sending not implemented in production', {
        notificationId: notification.id,
        recipient: notification.recipient
      });
      
      return false;
    } catch (error) {
      LoggerService.logError(error as Error, {
        context: 'sms_send',
        notificationId: notification.id,
        recipient: notification.recipient
      });
      return false;
    }
  }

  /**
   * 验证短信配置
   */
  static async validateConfig(): Promise<boolean> {
    // 开发环境总是返回true
    if (env.NODE_ENV === 'development') {
      return true;
    }

    // 生产环境检查必要的配置
    const hasConfig = !!(
      env.TWILIO_ACCOUNT_SID && 
      env.TWILIO_AUTH_TOKEN && 
      env.TWILIO_PHONE_NUMBER
    );

    if (!hasConfig) {
      LoggerService.logSystem('SMS configuration missing', {
        hasAccountSid: !!env.TWILIO_ACCOUNT_SID,
        hasAuthToken: !!env.TWILIO_AUTH_TOKEN,
        hasPhoneNumber: !!env.TWILIO_PHONE_NUMBER
      });
    }

    return hasConfig;
  }

  /**
   * 格式化短信内容
   */
  static formatSMSContent(notification: Notification): string {
    const data = notification.data ? JSON.parse(notification.data) : {};
    
    switch (notification.templateType) {
      case 'ORDER_CONFIRMATION':
        return `【Jiffoo Mall】您的订单${data.orderNumber}已确认，金额¥${data.totalAmount}。感谢您的购买！`;
      
      case 'ORDER_SHIPPED':
        return `【Jiffoo Mall】您的订单${data.orderNumber}已发货，快递单号：${data.trackingNumber}。请注意查收！`;
      
      case 'LOW_STOCK_ALERT':
        return `【Jiffoo Mall】库存警告：${data.productName}库存不足(${data.currentStock})，请及时补货。`;
      
      case 'ACCOUNT_VERIFICATION':
        return `【Jiffoo Mall】您的验证码是：${data.verificationCode}，5分钟内有效，请勿泄露。`;
      
      case 'PASSWORD_RESET':
        return `【Jiffoo Mall】您的密码重置验证码是：${data.resetCode}，10分钟内有效，请勿泄露。`;
      
      default:
        // 限制短信长度
        const content = notification.content;
        return content.length > 60 ? content.substring(0, 57) + '...' : content;
    }
  }

  /**
   * 检查手机号格式
   */
  static isValidPhoneNumber(phone: string): boolean {
    // 简单的中国手机号验证
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * 获取短信发送状态
   */
  static async getDeliveryStatus(messageId: string): Promise<string> {
    // TODO: 实现状态查询
    // 这里可以调用SMS服务商的API查询发送状态
    return 'delivered';
  }
}

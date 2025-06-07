import nodemailer from 'nodemailer';
import { Notification } from '../types';
import { LoggerService } from '@/core/logger/logger';
import { env } from '@/config/env';

export class EmailProvider {
  private static transporter: nodemailer.Transporter | null = null;

  /**
   * 初始化邮件传输器
   */
  private static async getTransporter(): Promise<nodemailer.Transporter> {
    if (!this.transporter) {
      // 开发环境使用 Ethereal Email 测试
      if (env.NODE_ENV === 'development') {
        const testAccount = await nodemailer.createTestAccount();

        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });

        LoggerService.logSystem('Email transporter initialized with test account', {
          user: testAccount.user,
          previewUrl: 'https://ethereal.email'
        });
      } else {
        // 生产环境配置
        this.transporter = nodemailer.createTransport({
          host: env.SMTP_HOST || 'localhost',
          port: env.SMTP_PORT || 587,
          secure: env.SMTP_SECURE || false,
          auth: {
            user: env.SMTP_USER || '',
            pass: env.SMTP_PASS || '',
          },
        });

        LoggerService.logSystem('Email transporter initialized with production config');
      }
    }

    return this.transporter;
  }

  /**
   * 发送邮件
   */
  static async send(notification: Notification): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();

      const mailOptions = {
        from: env.SMTP_FROM || 'noreply@jiffoo.com',
        to: notification.recipient,
        subject: notification.subject,
        html: this.formatEmailContent(notification),
        text: this.stripHtml(notification.content)
      };

      const info = await transporter.sendMail(mailOptions);

      // 开发环境显示预览链接
      if (env.NODE_ENV === 'development') {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        LoggerService.logSystem('Email sent (development)', {
          notificationId: notification.id,
          recipient: notification.recipient,
          previewUrl
        });
        console.log('📧 Email preview URL:', previewUrl);
      } else {
        LoggerService.logSystem('Email sent (production)', {
          notificationId: notification.id,
          recipient: notification.recipient,
          messageId: info.messageId
        });
      }

      return true;
    } catch (error) {
      LoggerService.logError(error as Error, {
        context: 'email_send',
        notificationId: notification.id,
        recipient: notification.recipient
      });
      return false;
    }
  }

  /**
   * 格式化邮件内容
   */
  private static formatEmailContent(notification: Notification): string {
    const data = notification.data ? JSON.parse(notification.data) : {};

    // 基础邮件模板
    const template = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${notification.subject}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .email-container {
            background-color: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
        }
        .content {
            margin-bottom: 30px;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #eee;
            padding-top: 20px;
            margin-top: 30px;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin: 10px 0;
        }
        .alert {
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
        }
        .alert-warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
        }
        .alert-danger {
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        .alert-info {
            background-color: #d1ecf1;
            border: 1px solid #bee5eb;
            color: #0c5460;
        }
        .product-info {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
        }
        .order-items {
            border-collapse: collapse;
            width: 100%;
            margin: 15px 0;
        }
        .order-items th,
        .order-items td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        .order-items th {
            background-color: #f2f2f2;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">🛍️ Jiffoo Mall</div>
            <div>您的专属购物平台</div>
        </div>

        <div class="content">
            ${this.getTemplateContent(notification, data)}
        </div>

        <div class="footer">
            <p>此邮件由 Jiffoo Mall 系统自动发送，请勿回复。</p>
            <p>如有疑问，请联系客服：support@jiffoo.com</p>
            <p>&copy; 2025 Jiffoo Mall. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    return template;
  }

  /**
   * 根据模板类型获取内容
   */
  private static getTemplateContent(notification: Notification, data: any): string {
    switch (notification.templateType) {
      case 'LOW_STOCK_ALERT':
        return `
          <div class="alert alert-warning">
            <h2>⚠️ 库存不足警告</h2>
            <div class="product-info">
              <p><strong>商品名称：</strong>${data.productName}</p>
              <p><strong>商品ID：</strong>${data.productId}</p>
              <p><strong>当前库存：</strong>${data.currentStock}</p>
              <p><strong>警告阈值：</strong>${data.threshold}</p>
            </div>
            <p>${data.message}</p>
            <p>请及时补货以避免缺货。</p>
          </div>`;

      case 'OUT_OF_STOCK_ALERT':
        return `
          <div class="alert alert-danger">
            <h2>🚨 商品缺货警告</h2>
            <div class="product-info">
              <p><strong>商品名称：</strong>${data.productName}</p>
              <p><strong>商品ID：</strong>${data.productId}</p>
              <p><strong>当前库存：</strong>${data.currentStock}</p>
            </div>
            <p>${data.message}</p>
            <p><strong>请立即补货！</strong></p>
          </div>`;

      case 'ORDER_CONFIRMATION':
        return `
          <h2>📦 订单确认</h2>
          <p>亲爱的 ${data.customerName}，</p>
          <p>感谢您的订购！您的订单已确认。</p>
          <div class="product-info">
            <p><strong>订单号：</strong>${data.orderNumber}</p>
            <p><strong>订单金额：</strong>¥${data.totalAmount}</p>
          </div>
          ${this.renderOrderItems(data.items)}
          <p>我们将尽快为您处理订单。</p>`;

      case 'USER_WELCOME':
        return `
          <h2>🎉 欢迎加入 Jiffoo Mall！</h2>
          <p>亲爱的 ${data.username}，</p>
          <p>欢迎您注册成为 Jiffoo Mall 的会员！</p>
          <p>在这里您可以：</p>
          <ul>
            <li>浏览丰富的商品</li>
            <li>享受优质的购物体验</li>
            <li>获得专属优惠和促销</li>
          </ul>
          <a href="#" class="button">开始购物</a>`;

      case 'PASSWORD_RESET':
        return `
          <h2>🔐 密码重置</h2>
          <p>您好，</p>
          <p>我们收到了您的密码重置请求。</p>
          <p>请点击下面的按钮重置您的密码：</p>
          <a href="#" class="button">重置密码</a>
          <p><small>此链接将在24小时后失效。如果您没有请求重置密码，请忽略此邮件。</small></p>`;

      default:
        return `
          <h2>${notification.subject}</h2>
          <div>${notification.content}</div>`;
    }
  }

  /**
   * 渲染订单商品列表
   */
  private static renderOrderItems(items: any[]): string {
    if (!items || items.length === 0) return '';

    let html = '<table class="order-items"><thead><tr><th>商品</th><th>数量</th><th>单价</th><th>小计</th></tr></thead><tbody>';

    items.forEach(item => {
      html += `
        <tr>
          <td>${item.productName}</td>
          <td>${item.quantity}</td>
          <td>¥${item.price}</td>
          <td>¥${(item.quantity * item.price).toFixed(2)}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    return html;
  }

  /**
   * 移除HTML标签
   */
  private static stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * 验证邮件配置
   */
  static async validateConfig(): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      await transporter.verify();
      return true;
    } catch (error) {
      LoggerService.logError(error as Error, { context: 'email_config_validation' });
      return false;
    }
  }
}

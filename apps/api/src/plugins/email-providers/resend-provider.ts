/**
 * Resend Email Provider
 *
 * Resend API 的适配器实现
 */

import { Resend } from 'resend';
import crypto from 'crypto';
import {
  BaseEmailProvider,
  EmailProviderConfig,
  SendEmailRequest,
  SendEmailResponse,
  EmailProviderCapabilities,
  EmailStatus
} from './base-provider';

export class ResendProvider extends BaseEmailProvider {
  private client: Resend;
  
  constructor(config: EmailProviderConfig) {
    super(config);
    this.providerName = 'resend';

    // 优先使用租户的API Key，否则使用平台的
    const apiKey = config.apiKey ? config.apiKey : (() => {
      const envApiKey = process.env.RESEND_API_KEY;
      if (!envApiKey) {
        throw new Error('RESEND_API_KEY environment variable is not set');
      }
      return envApiKey;
    })();

    this.client = new Resend(apiKey);
  }
  
  /**
   * 发送单封邮件
   */
  async send(request: SendEmailRequest): Promise<SendEmailResponse> {
    try {
      // 构建发件人地址
      const from = request.fromName
        ? `${request.fromName} <${request.from || 'noreply@chentsimo.top'}>`
        : request.from || 'noreply@chentsimo.top';
      
      // 发送邮件
      const result = await this.client.emails.send({
        from,
        to: Array.isArray(request.to) ? request.to : [request.to],
        subject: request.subject || 'No Subject',
        html: request.html,
        text: request.text,
        replyTo: request.replyTo,  // 修复：使用replyTo而不是reply_to
        cc: request.cc,
        bcc: request.bcc,
        attachments: request.attachments?.map(att => ({
          filename: att.filename,
          content: att.content as any
        })),
        tags: request.tags?.map(tag => ({ name: tag, value: 'true' }))
      });

      return {
        success: true,
        messageId: result.data?.id || 'unknown',  // 修复：使用result.data.id
        provider: 'resend'
      };
    } catch (error: any) {
      return {
        success: false,
        provider: 'resend',
        error: error.message,
        details: error
      };
    }
  }
  
  /**
   * 批量发送邮件
   */
  async sendBatch(requests: SendEmailRequest[]): Promise<SendEmailResponse[]> {
    // Resend支持批量发送，但我们使用Promise.allSettled来处理
    const results = await Promise.allSettled(
      requests.map(req => this.send(req))
    );
    
    return results.map(result => 
      result.status === 'fulfilled' 
        ? result.value 
        : { 
            success: false, 
            provider: 'resend', 
            error: 'Batch send failed',
            details: result.reason
          }
    );
  }
  
  /**
   * 获取邮件状态
   */
  async getStatus(messageId: string): Promise<EmailStatus> {
    try {
      const email = await this.client.emails.get(messageId);

      return {
        messageId: email.data?.id || messageId,  // 修复：使用email.data.id
        status: email.data?.last_event || 'sent',  // 修复：使用email.data.last_event
        events: []  // Resend API暂不提供详细事件列表
      };
    } catch (error: any) {
      throw new Error(`Failed to get email status: ${error.message}`);
    }
  }
  
  /**
   * 验证Webhook签名
   *
   * Resend使用HMAC-SHA256签名验证
   * 参考: https://resend.com/docs/webhooks
   *
   * @param signature - 请求头中的 svix-signature
   * @param payload - 原始请求体（字符串）
   * @param svixId - 请求头中的 svix-id
   * @param svixTimestamp - 请求头中的 svix-timestamp
   */
  verifyWebhook(
    signature: string,
    payload: string | object,
    svixId?: string,
    svixTimestamp?: string
  ): boolean {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('RESEND_WEBHOOK_SECRET not configured, skipping signature verification');
      return true; // 开发环境可以跳过验证
    }

    if (!signature || !svixId || !svixTimestamp) {
      console.error('Missing required webhook headers');
      return false;
    }

    try {
      // 验证时间戳（防止重放攻击，5分钟内有效）
      const timestamp = parseInt(svixTimestamp, 10);
      const now = Math.floor(Date.now() / 1000);
      const tolerance = 300; // 5 minutes

      if (Math.abs(now - timestamp) > tolerance) {
        console.error('Webhook timestamp too old or in the future');
        return false;
      }

      // 构建签名基础字符串
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const signedContent = `${svixId}.${svixTimestamp}.${payloadString}`;

      // 解析 webhook secret（格式: whsec_xxxxx）
      const secretBytes = Buffer.from(
        webhookSecret.startsWith('whsec_')
          ? webhookSecret.slice(6)
          : webhookSecret,
        'base64'
      );

      // 计算期望的签名
      const expectedSignature = crypto
        .createHmac('sha256', secretBytes)
        .update(signedContent)
        .digest('base64');

      // 解析签名头（格式: v1,signature1 v1,signature2）
      const signatures = signature.split(' ').map(s => {
        const [version, sig] = s.split(',');
        return { version, sig };
      });

      // 验证是否有匹配的签名
      const isValid = signatures.some(({ version, sig }) => {
        if (version !== 'v1') return false;
        return crypto.timingSafeEqual(
          Buffer.from(sig),
          Buffer.from(expectedSignature)
        );
      });

      if (!isValid) {
        console.error('Webhook signature verification failed');
      }

      return isValid;
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }
  
  /**
   * 获取提供商能力
   */
  getCapabilities(): EmailProviderCapabilities {
    return {
      supportsAttachments: true,
      supportsBatch: true,
      supportsScheduling: false,  // Resend暂不支持定时发送
      supportsTracking: true,     // 支持打开/点击追踪
      supportsWebhooks: true,
      maxAttachmentSize: 40,      // 40MB
      maxBatchSize: 100           // 每批最多100封
    };
  }
  
  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 尝试获取API Key信息（不实际发送邮件）
      // Resend没有专门的健康检查端点，我们通过尝试获取域名列表来验证
      await this.client.domains.list();
      return true;
    } catch (error) {
      console.error('Resend health check failed:', error);
      return false;
    }
  }
}


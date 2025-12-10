/**
 * Base Email Provider Interface
 * 
 * 定义所有邮件提供商必须实现的接口
 */

export interface EmailProviderConfig {
  mode?: 'platform' | 'byok';  // Platform模式 or Bring Your Own Key
  apiKey?: string;
  webhookSecret?: string;
  customSettings?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;  // Base64 string or Buffer
  contentType?: string;
  size?: number;  // Size in bytes
}

export interface SendEmailRequest {
  to: string | string[];
  from?: string;
  fromName?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
  details?: any;
}

export interface EmailProviderCapabilities {
  supportsAttachments: boolean;
  supportsBatch: boolean;
  supportsScheduling: boolean;
  supportsTracking: boolean;
  supportsWebhooks: boolean;
  maxAttachmentSize: number;  // MB
  maxBatchSize: number;
}

export interface EmailStatus {
  messageId: string;
  status: string;  // 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'
  events?: Array<{
    type: string;
    timestamp: Date;
  }>;
}

/**
 * Base Email Provider Abstract Class
 * 
 * 所有邮件提供商必须继承此类并实现抽象方法
 */
export abstract class BaseEmailProvider {
  protected config: EmailProviderConfig;
  protected providerName: string;
  
  constructor(config: EmailProviderConfig) {
    this.config = config;
    this.providerName = 'base';
  }
  
  /**
   * 发送单封邮件
   */
  abstract send(request: SendEmailRequest): Promise<SendEmailResponse>;
  
  /**
   * 批量发送邮件
   */
  abstract sendBatch(requests: SendEmailRequest[]): Promise<SendEmailResponse[]>;
  
  /**
   * 获取邮件状态
   */
  abstract getStatus(messageId: string): Promise<EmailStatus>;
  
  /**
   * 验证Webhook签名
   */
  abstract verifyWebhook(signature: string, payload: any): boolean;
  
  /**
   * 获取提供商能力
   */
  abstract getCapabilities(): EmailProviderCapabilities;
  
  /**
   * 健康检查
   */
  abstract healthCheck(): Promise<boolean>;
  
  /**
   * 获取提供商名称
   */
  getProviderName(): string {
    return this.providerName;
  }
  
  /**
   * 获取配置模式
   */
  getMode(): 'platform' | 'byok' {
    return this.config.mode;
  }
}


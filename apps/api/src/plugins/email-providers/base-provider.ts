/**
 * Base Email Provider Interface
 * 
 * Defines the interface that all email providers must implement
 */

export interface EmailProviderConfig {
  mode?: 'platform' | 'byok';  // Platform mode or Bring Your Own Key
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
 * All email providers must inherit from this class and implement abstract methods
 */
export abstract class BaseEmailProvider {
  protected config: EmailProviderConfig;
  protected providerName: string;

  constructor(config: EmailProviderConfig) {
    this.config = config;
    this.providerName = 'base';
  }

  /**
   * Send a single email
   */
  abstract send(request: SendEmailRequest): Promise<SendEmailResponse>;

  /**
   * Batch send emails
   */
  abstract sendBatch(requests: SendEmailRequest[]): Promise<SendEmailResponse[]>;

  /**
   * Get email status
   */
  abstract getStatus(messageId: string): Promise<EmailStatus>;

  /**
   * Verify Webhook signature
   */
  abstract verifyWebhook(signature: string, payload: any): boolean;

  /**
   * Get provider capabilities
   */
  abstract getCapabilities(): EmailProviderCapabilities;

  /**
   * Health check
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Get provider name
   */
  getProviderName(): string {
    return this.providerName;
  }

  /**
   * Get configuration mode
   */
  getMode(): 'platform' | 'byok' {
    return (this.config.mode as 'platform' | 'byok') || 'platform';
  }
}

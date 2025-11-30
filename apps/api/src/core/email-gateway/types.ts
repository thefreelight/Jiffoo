/**
 * Email Gateway Types
 * 
 * 统一邮件网关的类型定义
 */

/**
 * 邮件提供商信息
 */
export interface EmailProvider {
  pluginSlug: string;
  name: string;
  displayName: string;
  icon: string;
  capabilities: {
    supportsAttachments: boolean;
    supportsBatch: boolean;
    supportsScheduling: boolean;
    supportsTracking: boolean;
  };
}

/**
 * 发送邮件请求
 */
export interface SendEmailRequest {
  to: string | string[];
  from?: string;
  fromName?: string;
  subject?: string;  // 可选：使用模板时从模板获取
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: any[];
  tags?: string[];
  metadata?: Record<string, any>;
  provider?: string;  // 可选：指定使用哪个插件
  priority?: 'high' | 'normal' | 'low';
  templateSlug?: string;  // 可选：使用模板
  templateVariables?: Record<string, any>;
}

/**
 * 发送邮件响应
 */
export interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
  message?: string;
}

/**
 * 插件元数据映射
 */
export const EMAIL_PLUGIN_INFO_MAP: Record<string, any> = {
  'resend': {
    displayName: 'Resend',
    icon: '/icons/resend.svg',
    capabilities: {
      supportsAttachments: true,
      supportsBatch: true,
      supportsScheduling: false,
      supportsTracking: true
    }
  },
  'sendgrid-email': {
    displayName: 'SendGrid',
    icon: '/icons/sendgrid.svg',
    capabilities: {
      supportsAttachments: true,
      supportsBatch: true,
      supportsScheduling: true,
      supportsTracking: true
    }
  },
  'mailgun-email': {
    displayName: 'Mailgun',
    icon: '/icons/mailgun.svg',
    capabilities: {
      supportsAttachments: true,
      supportsBatch: true,
      supportsScheduling: true,
      supportsTracking: true
    }
  },
  'aws-ses-email': {
    displayName: 'AWS SES',
    icon: '/icons/aws.svg',
    capabilities: {
      supportsAttachments: true,
      supportsBatch: true,
      supportsScheduling: false,
      supportsTracking: false
    }
  }
};

/**
 * 获取插件元数据
 */
export function getEmailPluginInfo(pluginSlug: string): any {
  return EMAIL_PLUGIN_INFO_MAP[pluginSlug] || {
    displayName: pluginSlug,
    icon: '/icons/default.svg',
    capabilities: {
      supportsAttachments: false,
      supportsBatch: false,
      supportsScheduling: false,
      supportsTracking: false
    }
  };
}


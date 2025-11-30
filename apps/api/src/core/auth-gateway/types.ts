/**
 * Auth Gateway Types
 * 
 * 认证网关类型定义
 */

/**
 * 认证方式
 */
export interface AuthMethod {
  pluginSlug: string;
  name: string;
  displayName: string;
  icon: string;
  type: 'oauth' | 'email' | 'sms' | 'passwordless';
  capabilities: {
    supportsRegistration: boolean;
    supportsLogin: boolean;
    supportsPasswordReset: boolean;
    requiresVerification: boolean;
  };
}

/**
 * 认证插件元数据映射
 */
export const AUTH_PLUGIN_INFO_MAP: Record<string, any> = {
  'google': {
    displayName: 'Google',
    icon: '/icons/google.svg',
    type: 'oauth',
    capabilities: {
      supportsRegistration: true,
      supportsLogin: true,
      supportsPasswordReset: false,
      requiresVerification: false
    }
  },
  'resend': {
    displayName: 'Email Verification',
    icon: '/icons/email.svg',
    type: 'email',
    capabilities: {
      supportsRegistration: true,
      supportsLogin: true,
      supportsPasswordReset: true,
      requiresVerification: true
    }
  },
  'twilio-sms': {
    displayName: 'SMS Verification',
    icon: '/icons/sms.svg',
    type: 'sms',
    capabilities: {
      supportsRegistration: true,
      supportsLogin: true,
      supportsPasswordReset: true,
      requiresVerification: true
    }
  }
};

/**
 * 获取认证插件元数据
 */
export function getAuthPluginInfo(pluginSlug: string): any {
  return AUTH_PLUGIN_INFO_MAP[pluginSlug] || {
    displayName: pluginSlug,
    icon: '/icons/default.svg',
    type: 'oauth',
    capabilities: {
      supportsRegistration: false,
      supportsLogin: false,
      supportsPasswordReset: false,
      requiresVerification: false
    }
  };
}


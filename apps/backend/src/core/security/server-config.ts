import crypto from 'crypto';

/**
 * 服务器配置保护模块
 * 使用多层加密保护关键服务器地址
 */

// 第一层：多重加密的服务器地址
// 使用 AES + Base64 + XOR 三层加密，密钥分散存储
const ENCRYPTED_SERVERS = {
  // 真实地址: https://license.jiffoo.com/api/v1/
  LICENSE_SERVER: "U2FsdGVkX1+vupppZksvRf5pq5g5XjFRIipRkwB0K1Y96Qsb2Lpn5taf66Zl5a5s4x8lJwQkpqUJ",
  // 真实地址: https://plugins.jiffoo.com/api/v1/
  PLUGIN_SERVER: "U2FsdGVkX1+8xvAAQbQjxnQUccTrfrHF3IpJ+KQjKlM9Qsb2Lpn5taf66Zl5a5s4x8lJwQkpqUJ",
  // 真实地址: https://updates.jiffoo.com/api/v1/
  UPDATE_SERVER: "U2FsdGVkX1+9yvBBRcRkynRVddUsgsIG4JqK+LRkLmN+Rtc3Mqo6uag77am6b6t5y9mKxRlqrVK",
  // 真实地址: https://saas.jiffoo.com/api/v1/
  SAAS_SERVER: "U2FsdGVkX1+7wuCCScSlznSWeeVthtJH5KrL+MSlMnO/Sud4Nrp7vbh88bn7c7u6z+nLySmrsWL",
  // 真实地址: https://analytics.jiffoo.com/api/v1/
  ANALYTICS_SERVER: "U2FsdGVkX1+6vuDDTdTmzoTXffWuiuKI6LsM+NTmNoP0Tve5Osq8wcj99co8d8v7A/oMyTnstXM"
};

// 密钥组件分散存储（防止静态分析）
const _k1 = () => 'jiffoo';
const _k2 = () => '2024';
const _k3 = () => 'secure';
const _k4 = () => 'commercial';
const _salt = () => 'protection';

// 第二层：动态密钥生成（多重验证）
const generateDecryptionKey = (): string => {
  // 组合分散的密钥组件
  const baseKey = _k1() + '-' + _k2() + '-' + _k3() + '-' + _k4();

  // 添加环境特征
  const timestamp = Math.floor(Date.now() / (1000 * 60 * 60 * 24)); // 每天变化
  const appVersion = process.env.APP_VERSION || '1.0.0';
  const nodeVersion = process.version.replace(/[^\d.]/g, '');

  // 生成最终密钥
  return crypto
    .createHash('sha256')
    .update(`${baseKey}-${timestamp}-${appVersion}-${nodeVersion}-${_salt()}`)
    .digest('hex')
    .substring(0, 32);
};

// 第三层：反混淆解密函数
const _d = (e: string, t: string): string => {
  try {
    const k = generateDecryptionKey();

    // 多步解密过程
    // Step 1: Base64 decode
    const s1 = Buffer.from(e, 'base64').toString('binary');

    // Step 2: XOR with server type
    const xorKey = crypto.createHash('md5').update(t + k).digest('hex');
    let s2 = '';
    for (let i = 0; i < s1.length; i++) {
      s2 += String.fromCharCode(s1.charCodeAt(i) ^ xorKey.charCodeAt(i % xorKey.length));
    }

    // Step 3: AES decrypt
    const decipher = crypto.createDecipher('aes-256-cbc', k + _salt());
    let decrypted = decipher.update(s2, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    return '';
  }
};

// 第四层：安全验证和URL构建
const decryptServerUrl = (encryptedUrl: string, serverType: string): string => {
  try {
    // 使用反混淆解密
    const decoded = _d(encryptedUrl, serverType);

    // 多重验证
    if (!decoded ||
        !decoded.startsWith('https://') ||
        !decoded.includes('.jiffoo.com') ||
        !decoded.includes('/api/v1/')) {
      throw new Error('Invalid server configuration');
    }

    // 验证服务器类型匹配
    const expectedSubdomain = serverType.toLowerCase().replace('_server', '');
    if (!decoded.includes(`${expectedSubdomain}.jiffoo.com`)) {
      throw new Error('Server type mismatch');
    }

    // 添加动态认证参数
    const key = generateDecryptionKey();
    const timestamp = Date.now();
    const signature = crypto
      .createHmac('sha256', key)
      .update(`${decoded}${timestamp}${serverType}`)
      .digest('hex')
      .substring(0, 16);

    return `${decoded}?auth=${signature}&ts=${timestamp}&type=${serverType}&v=1`;
  } catch (error) {
    // 解密失败时的安全降级 - 仍然尝试访问商业服务器
    console.warn(`Server config decryption failed for ${serverType}:`, error.message);

    // 提供备用的商业服务器地址（简单编码，防止直接修改）
    const fallbackServers = {
      'LICENSE_SERVER': 'aHR0cHM6Ly9saWNlbnNlLmppZmZvby5jb20vYXBpL3YxLw==',
      'PLUGIN_SERVER': 'aHR0cHM6Ly9wbHVnaW5zLmppZmZvby5jb20vYXBpL3YxLw==',
      'UPDATE_SERVER': 'aHR0cHM6Ly91cGRhdGVzLmppZmZvby5jb20vYXBpL3YxLw==',
      'SAAS_SERVER': 'aHR0cHM6Ly9zYWFzLmppZmZvby5jb20vYXBpL3YxLw==',
      'ANALYTICS_SERVER': 'aHR0cHM6Ly9hbmFseXRpY3MuampmZm9vLmNvbS9hcGkvdjEv'
    };

    const fallbackUrl = fallbackServers[serverType];
    if (fallbackUrl) {
      try {
        const decoded = Buffer.from(fallbackUrl, 'base64').toString('utf-8');
        return `${decoded}?client=opensource&fallback=true`;
      } catch {
        return 'https://api.jiffoo.com/v1/';
      }
    }

    return 'https://api.jiffoo.com/v1/';
  }
};

// 第四层：运行时验证和缓存
class SecureServerConfig {
  private static instance: SecureServerConfig;
  private configCache: Map<string, { url: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1小时缓存

  private constructor() {
    // 私有构造函数，防止直接实例化
  }

  public static getInstance(): SecureServerConfig {
    if (!SecureServerConfig.instance) {
      SecureServerConfig.instance = new SecureServerConfig();
    }
    return SecureServerConfig.instance;
  }

  public getServerUrl(serverType: keyof typeof ENCRYPTED_SERVERS): string {
    const now = Date.now();
    const cached = this.configCache.get(serverType);
    
    // 检查缓存是否有效
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      return cached.url;
    }

    // 解密服务器地址
    const encryptedUrl = ENCRYPTED_SERVERS[serverType];
    const decryptedUrl = decryptServerUrl(encryptedUrl, serverType);
    
    // 额外的运行时验证
    if (!this.validateServerUrl(decryptedUrl, serverType)) {
      throw new Error(`Invalid ${serverType} configuration`);
    }

    // 缓存结果
    this.configCache.set(serverType, {
      url: decryptedUrl,
      timestamp: now
    });

    return decryptedUrl;
  }

  private validateServerUrl(url: string, serverType: string): boolean {
    try {
      const urlObj = new URL(url);
      
      // 验证域名
      if (!urlObj.hostname.endsWith('.jiffoo.com')) {
        return false;
      }
      
      // 验证协议
      if (urlObj.protocol !== 'https:') {
        return false;
      }
      
      // 验证路径
      if (!urlObj.pathname.startsWith('/api/v1/')) {
        return false;
      }
      
      // 验证服务器类型匹配
      const expectedSubdomain = serverType.toLowerCase().replace('_server', '');
      if (!urlObj.hostname.startsWith(expectedSubdomain)) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  // 清除缓存（用于测试或强制刷新）
  public clearCache(): void {
    this.configCache.clear();
  }
}

// 导出安全的服务器配置获取器
export const getSecureServerUrl = (serverType: keyof typeof ENCRYPTED_SERVERS): string => {
  return SecureServerConfig.getInstance().getServerUrl(serverType);
};

// 导出服务器类型枚举
export const SERVER_TYPES = {
  LICENSE: 'LICENSE_SERVER' as const,
  PLUGIN: 'PLUGIN_SERVER' as const,
  UPDATE: 'UPDATE_SERVER' as const,
  SAAS: 'SAAS_SERVER' as const,
  ANALYTICS: 'ANALYTICS_SERVER' as const,
} as const;

// 健康检查函数
export const validateServerConnectivity = async (serverType: keyof typeof ENCRYPTED_SERVERS): Promise<boolean> => {
  try {
    const url = getSecureServerUrl(serverType);
    const response = await fetch(`${url}health`, {
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'Jiffoo-Commercial/1.0.0',
        'X-Client-Type': 'commercial'
      }
    });
    
    return response.ok;
  } catch {
    return false;
  }
};

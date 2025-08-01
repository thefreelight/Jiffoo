/**
 * 商业服务器配置 - 待混淆版本
 * 此文件将被 JavaScript 混淆器处理，用户无法读取源码
 */

// Base64 编码的服务器地址（第一层保护）
const _s = {
  l: 'aHR0cHM6Ly9saWNlbnNlLmppZmZvby5jb20vYXBpL3YxLw==',
  p: 'aHR0cHM6Ly9wbHVnaW5zLmppZmZvby5jb20vYXBpL3YxLw==', 
  u: 'aHR0cHM6Ly91cGRhdGVzLmppZmZvby5jb20vYXBpL3YxLw==',
  s: 'aHR0cHM6Ly9zYWFzLmppZmZvby5jb20vYXBpL3YxLw==',
  a: 'aHR0cHM6Ly9hbmFseXRpY3MuampmZm9vLmNvbS9hcGkvdjEv'
};

// 客户端指纹生成（用于服务器验证）
function _gf() {
  const os = require('os');
  const crypto = require('crypto');
  
  const fingerprint = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    appVersion: process.env.APP_VERSION || '1.0.0',
    timestamp: Date.now()
  };
  
  return crypto.createHash('sha256')
    .update(JSON.stringify(fingerprint))
    .digest('hex')
    .substring(0, 16);
}

// 解码服务器地址
function _d(encoded) {
  try {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  } catch {
    return 'https://api.jiffoo.com/v1/';
  }
}

// 验证服务器地址格式
function _v(url) {
  return url.startsWith('https://') && 
         url.includes('.jiffoo.com') && 
         url.includes('/api/v1/');
}

// 构建带验证参数的服务器 URL
function _b(serverType, baseUrl) {
  const clientType = process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource';
  const fingerprint = _gf();
  const timestamp = Date.now();
  
  // 生成请求签名（服务器会验证这个签名）
  const crypto = require('crypto');
  const signatureData = `${baseUrl}${clientType}${fingerprint}${timestamp}`;
  const _k1 = 'jiffoo', _k2 = 'secret', _k3 = '2024';
  const signature = crypto.createHash('md5').update(signatureData + `${_k1}-${_k2}-${_k3}`).digest('hex').substring(0, 12);
  
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}client=${clientType}&fp=${fingerprint}&ts=${timestamp}&sig=${signature}&type=${serverType}`;
}

// 主要的服务器 URL 获取函数
function getCommercialServerUrl(serverType) {
  let encoded, type;
  
  switch (serverType) {
    case 'license':
      encoded = _s.l;
      type = 'license';
      break;
    case 'plugin':
      encoded = _s.p;
      type = 'plugin';
      break;
    case 'update':
      encoded = _s.u;
      type = 'update';
      break;
    case 'saas':
      encoded = _s.s;
      type = 'saas';
      break;
    case 'analytics':
      encoded = _s.a;
      type = 'analytics';
      break;
    default:
      return 'https://api.jiffoo.com/v1/';
  }
  
  const decoded = _d(encoded);
  
  if (!_v(decoded)) {
    return 'https://api.jiffoo.com/v1/';
  }
  
  return _b(type, decoded);
}

// 服务类
class CommercialPluginService {
  constructor() {
    this.serverUrl = getCommercialServerUrl('plugin');
  }
  
  async browsePlugins() {
    try {
      const response = await fetch(this.serverUrl + 'browse', {
        method: 'GET',
        headers: {
          'User-Agent': 'Jiffoo/1.0.0',
          'X-Client-Type': process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource',
          'X-Client-Fingerprint': _gf()
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return data.plugins || [];
    } catch (error) {
      console.error('Browse plugins error:', error);
      return [];
    }
  }
  
  async purchasePlugin(pluginId, userEmail, paymentToken) {
    try {
      const response = await fetch(this.serverUrl + 'purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Jiffoo/1.0.0',
          'X-Client-Type': process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource',
          'X-Client-Fingerprint': _gf()
        },
        body: JSON.stringify({
          pluginId,
          userEmail,
          paymentToken,
          clientFingerprint: _gf(),
          timestamp: Date.now()
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Purchase plugin error:', error);
      return { success: false, error: error.message };
    }
  }
}

class CommercialSaaSService {
  constructor() {
    this.serverUrl = getCommercialServerUrl('saas');
  }
  
  async browseServices() {
    try {
      const response = await fetch(this.serverUrl + 'services', {
        method: 'GET',
        headers: {
          'User-Agent': 'Jiffoo/1.0.0',
          'X-Client-Type': process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource',
          'X-Client-Fingerprint': _gf()
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return data.services || [];
    } catch (error) {
      console.error('Browse SaaS services error:', error);
      return [];
    }
  }
  
  async subscribe(serviceId, planId, userEmail, paymentToken) {
    try {
      const response = await fetch(this.serverUrl + 'subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Jiffoo/1.0.0',
          'X-Client-Type': process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource',
          'X-Client-Fingerprint': _gf()
        },
        body: JSON.stringify({
          serviceId,
          planId,
          userEmail,
          paymentToken,
          clientFingerprint: _gf(),
          timestamp: Date.now()
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('SaaS subscription error:', error);
      return { success: false, error: error.message };
    }
  }
}

class CommercialLicenseService {
  constructor() {
    this.serverUrl = getCommercialServerUrl('license');
  }
  
  async validateLicense(licenseKey, pluginId) {
    try {
      const response = await fetch(this.serverUrl + 'validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Jiffoo/1.0.0',
          'X-Client-Type': process.env.JIFFOO_EDITION === 'commercial' ? 'commercial' : 'opensource',
          'X-Client-Fingerprint': _gf()
        },
        body: JSON.stringify({
          licenseKey,
          pluginId,
          clientFingerprint: _gf(),
          timestamp: Date.now()
        })
      });
      
      if (!response.ok) {
        return false;
      }
      
      const result = await response.json();
      return result.valid === true;
    } catch (error) {
      console.error('License validation error:', error);
      return false;
    }
  }
}

// 导出服务实例
module.exports = {
  getCommercialServerUrl,
  CommercialPluginService,
  CommercialSaaSService,
  CommercialLicenseService,
  pluginService: new CommercialPluginService(),
  saasService: new CommercialSaaSService(),
  licenseService: new CommercialLicenseService()
};

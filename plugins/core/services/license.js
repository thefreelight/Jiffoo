"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.licenseService = exports.PluginLicenseService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const types_1 = require("../types");
class PluginLicenseService {
    publicKey;
    licenseServerUrl;
    constructor() {
        // 在生产环境中，这些应该从环境变量或配置文件中读取
        this.publicKey = process.env.PLUGIN_LICENSE_PUBLIC_KEY || '';
        this.licenseServerUrl = process.env.PLUGIN_LICENSE_SERVER_URL || 'https://api.jiffoo.com/licenses';
    }
    /**
     * 验证插件许可证
     */
    async validateLicense(pluginName, license) {
        try {
            // 1. 检查许可证类型
            if (license.type === types_1.PluginLicenseType.MIT) {
                return { valid: true, features: ['basic'] };
            }
            // 2. 检查许可证密钥
            if (!license.key) {
                return { valid: false, reason: 'License key is required for commercial plugins' };
            }
            // 3. 检查过期时间
            if (license.validUntil && new Date() > license.validUntil) {
                return { valid: false, reason: 'License has expired' };
            }
            // 4. 验证许可证签名
            const isSignatureValid = await this.verifyLicenseSignature(pluginName, license);
            if (!isSignatureValid) {
                return { valid: false, reason: 'Invalid license signature' };
            }
            // 5. 在线验证（可选）
            const onlineValidation = await this.validateOnline(pluginName, license);
            if (!onlineValidation.valid) {
                return onlineValidation;
            }
            return {
                valid: true,
                features: license.features || [],
                expiresAt: license.validUntil
            };
        }
        catch (error) {
            console.error('License validation error:', error);
            return { valid: false, reason: 'License validation failed' };
        }
    }
    /**
     * 验证许可证签名
     */
    async verifyLicenseSignature(pluginName, license) {
        if (!this.publicKey || !license.key) {
            return false;
        }
        try {
            // 解析许可证密钥（假设格式为 base64编码的签名数据）
            const [payload, signature] = license.key.split('.');
            if (!payload || !signature) {
                return false;
            }
            // 验证签名
            const verifier = crypto_1.default.createVerify('RSA-SHA256');
            verifier.update(payload);
            const isValid = verifier.verify(this.publicKey, signature, 'base64');
            if (isValid) {
                // 解析payload并验证插件名称
                const licenseData = JSON.parse(Buffer.from(payload, 'base64').toString());
                return licenseData.pluginName === pluginName;
            }
            return false;
        }
        catch (error) {
            console.error('Signature verification error:', error);
            return false;
        }
    }
    /**
     * 在线验证许可证
     */
    async validateOnline(pluginName, license) {
        try {
            const response = await fetch(`${this.licenseServerUrl}/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    pluginName,
                    licenseKey: license.key,
                    domain: this.getCurrentDomain(),
                    timestamp: Date.now()
                }),
                // 设置超时，避免阻塞
                signal: AbortSignal.timeout(5000)
            });
            if (!response.ok) {
                return { valid: false, reason: 'License server validation failed' };
            }
            const result = await response.json();
            return result;
        }
        catch (error) {
            // 网络错误时，如果是商业许可证，可以允许离线验证
            if (license.type === types_1.PluginLicenseType.COMMERCIAL) {
                console.warn('Online validation failed, falling back to offline validation');
                return { valid: true, features: license.features || [] };
            }
            return { valid: false, reason: 'Online validation required but failed' };
        }
    }
    /**
     * 获取当前域名
     */
    getCurrentDomain() {
        return process.env.DOMAIN || 'localhost';
    }
    /**
     * 生成试用许可证
     */
    generateTrialLicense(pluginName, durationDays = 30) {
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + durationDays);
        return {
            type: types_1.PluginLicenseType.COMMERCIAL,
            key: `trial.${Buffer.from(JSON.stringify({
                pluginName,
                type: 'trial',
                validUntil: validUntil.toISOString(),
                features: ['basic']
            })).toString('base64')}`,
            validUntil,
            features: ['basic']
        };
    }
    /**
     * 检查功能权限
     */
    hasFeature(license, feature) {
        if (license.type === types_1.PluginLicenseType.MIT) {
            return true; // MIT 许可证允许所有基础功能
        }
        return license.features?.includes(feature) || false;
    }
}
exports.PluginLicenseService = PluginLicenseService;
// 单例实例
exports.licenseService = new PluginLicenseService();
//# sourceMappingURL=license.js.map
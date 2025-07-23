"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginType = exports.PluginStatus = exports.PluginLicenseType = void 0;
// ==================== 基础类型定义 ====================
// 插件许可证类型
var PluginLicenseType;
(function (PluginLicenseType) {
    PluginLicenseType["MIT"] = "MIT";
    PluginLicenseType["COMMERCIAL"] = "COMMERCIAL";
    PluginLicenseType["PREMIUM"] = "PREMIUM";
    PluginLicenseType["ENTERPRISE"] = "ENTERPRISE";
})(PluginLicenseType || (exports.PluginLicenseType = PluginLicenseType = {}));
// 插件状态枚举
var PluginStatus;
(function (PluginStatus) {
    PluginStatus["INSTALLED"] = "INSTALLED";
    PluginStatus["ACTIVE"] = "ACTIVE";
    PluginStatus["INACTIVE"] = "INACTIVE";
    PluginStatus["UNINSTALLED"] = "UNINSTALLED";
    PluginStatus["ERROR"] = "ERROR";
})(PluginStatus || (exports.PluginStatus = PluginStatus = {}));
// 插件类型枚举
var PluginType;
(function (PluginType) {
    PluginType["PAYMENT"] = "payment";
    PluginType["AUTH"] = "auth";
    PluginType["NOTIFICATION"] = "notification";
    PluginType["ANALYTICS"] = "analytics";
    PluginType["SHIPPING"] = "shipping";
    PluginType["TAX"] = "tax";
    PluginType["MARKETING"] = "marketing";
    PluginType["INVENTORY"] = "inventory";
    PluginType["CUSTOM"] = "custom";
})(PluginType || (exports.PluginType = PluginType = {}));
//# sourceMappingURL=index.js.map
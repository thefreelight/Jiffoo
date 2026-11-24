/**
 * Simplified/Traditional Chinese overlays for official-extension catalog
 * entries. The marketplace catalog carries English-only name/description
 * fields (the platform catalog API has no localized fields), so the admin
 * renders these overlays when the session locale is Chinese. Slugs without
 * an entry fall back to the catalog text.
 */

export interface ExtensionCatalogLocalization {
  name: string;
  description: string;
}

const ZH_HANS: Record<string, ExtensionCatalogLocalization> = {
  seo: {
    name: 'SEO 管理器',
    description: '重定向管理：命中统计、404 监控与一键转换。robots.txt、sitemap.xml、canonical/hreflang 与产品结构化数据已内置于框架，随店面自动生效。',
  },
  'programmatic-seo': {
    name: '程序化 SEO',
    description: '按模板批量生成 SEO 落地页，通过店面路由渲染，放大长尾关键词覆盖。',
  },
  'aeo-booster': {
    name: 'AEO 加速器',
    description: '面向 AI 搜索的答案引擎优化：AI 爬虫访问策略、llms.txt 与 FAQ 结构化数据。',
  },
  cms: { name: '内容管理', description: '站点内容与 CMS 能力。' },
  i18n: { name: '多语言', description: '店面多语言与区域设置管理。' },
  coupon: { name: '优惠券', description: '优惠券与促销规则管理。' },
  reviews: { name: '商品评价', description: '商品评价收集与展示。' },
  'media-storage': { name: '媒体存储', description: '图片与媒体资源的存储管理。' },
  'support-hub': {
    name: '客服中心',
    description: '店面联系入口与 AI 客服聊天：AI 自动回复、转人工渠道、会话留存，以及可选的机器人 Webhook。',
  },
  'smtp-email': { name: 'SMTP 邮件', description: '用于验证码与事务邮件的 SMTP 发信通道。' },
  stripe: { name: 'Stripe 支付', description: 'Stripe 收银台、Webhook 与退款。' },
  shipping: { name: '物流', description: '物流追踪、Odoo 履约、快递100 与 4PX 承运商操作。' },
  wallet: { name: '虚拟钱包', description: '储值余额与交易流水。' },
  subscription: { name: '订阅与会员', description: '订阅与会员状态管理。' },
  affiliate: { name: '联盟营销', description: '联盟伙伴、推荐归因与佣金账本，支持店面自助入驻。' },
  'imager-ai': { name: 'AI 图像生成', description: '按钱包额度计费的 AI 图像生成。' },
  odoo: { name: 'Odoo', description: '对接 Odoo 的商品、库存、订单与履约。' },
  'google-auth': { name: 'Google 登录', description: '使用 Google 账号注册、登录与绑定。' },
  'facebook-auth': { name: 'Facebook 登录', description: '使用 Facebook 账号注册、登录与绑定。' },
  'apple-auth': { name: 'Apple 登录', description: '使用 Apple 账号注册、登录与绑定。' },
};

const ZH_HANT: Record<string, ExtensionCatalogLocalization> = {
  seo: {
    name: 'SEO 管理器',
    description: '重定向管理：命中統計、404 監控與一鍵轉換。robots.txt、sitemap.xml、canonical/hreflang 與商品結構化資料已內建於框架，隨店面自動生效。',
  },
  'programmatic-seo': {
    name: '程式化 SEO',
    description: '按模板批次生成 SEO 落地頁，透過店面路由渲染，放大長尾關鍵字覆蓋。',
  },
  'aeo-booster': {
    name: 'AEO 加速器',
    description: '面向 AI 搜尋的答案引擎最佳化：AI 爬蟲存取策略、llms.txt 與 FAQ 結構化資料。',
  },
  cms: { name: '內容管理', description: '站點內容與 CMS 能力。' },
  i18n: { name: '多語言', description: '店面多語言與區域設定管理。' },
  coupon: { name: '優惠券', description: '優惠券與促銷規則管理。' },
  reviews: { name: '商品評價', description: '商品評價收集與展示。' },
  'media-storage': { name: '媒體儲存', description: '圖片與媒體資源的儲存管理。' },
  'support-hub': {
    name: '客服中心',
    description: '店面聯絡入口與 AI 客服聊天：AI 自動回覆、轉人工管道、對話留存，以及可選的機器人 Webhook。',
  },
  'smtp-email': { name: 'SMTP 郵件', description: '用於驗證碼與事務郵件的 SMTP 發信通道。' },
  stripe: { name: 'Stripe 支付', description: 'Stripe 結帳、Webhook 與退款。' },
  shipping: { name: '物流', description: '物流追蹤、Odoo 履約、快遞100 與 4PX 承運商操作。' },
  wallet: { name: '虛擬錢包', description: '儲值餘額與交易流水。' },
  subscription: { name: '訂閱與會員', description: '訂閱與會員狀態管理。' },
  affiliate: { name: '聯盟行銷', description: '聯盟夥伴、推薦歸因與佣金帳本，支援店面自助入駐。' },
  'imager-ai': { name: 'AI 圖像生成', description: '按錢包額度計費的 AI 圖像生成。' },
  odoo: { name: 'Odoo', description: '對接 Odoo 的商品、庫存、訂單與履約。' },
  'google-auth': { name: 'Google 登入', description: '使用 Google 帳號註冊、登入與綁定。' },
  'facebook-auth': { name: 'Facebook 登入', description: '使用 Facebook 帳號註冊、登入與綁定。' },
  'apple-auth': { name: 'Apple 登入', description: '使用 Apple 帳號註冊、登入與綁定。' },
};

/**
 * Simplified/Traditional Chinese overlays for plugin configuration fields.
 * The native plugin catalog carries English-only field labels, so the
 * settings forms render these overlays when the session locale is Chinese.
 * A field without an entry falls back to the catalog label.
 */
type ConfigFieldLocalization = string | { label: string; description?: string };

const CONFIG_FIELDS_ZH_HANS: Record<string, Record<string, ConfigFieldLocalization>> = {
  'support-hub': {
    enabled: '启用 Support Hub',
    telegramEnabled: '启用 Telegram', telegramLink: 'Telegram 链接',
    whatsappEnabled: '启用 WhatsApp', whatsappLink: 'WhatsApp 链接',
    feishuEnabled: '启用飞书 / Lark', feishuLink: '飞书 / Lark 链接',
    httpsChatEnabled: '启用网页聊天', httpsChatUrl: '网页聊天地址',
    retentionDays: '会话保留天数', autoAssign: '自动分配', defaultQueue: '默认队列',
    chatEnabled: '启用客服聊天', aiEnabled: '启用 AI 回复', aiProvider: 'AI 服务商',
    aiBaseUrl: 'AI 接口地址', aiApiKey: 'AI API 密钥', aiModel: 'AI 模型',
    aiSystemPrompt: 'AI 系统提示词', aiWelcomeMessage: '聊天欢迎语', aiHandoffMessage: '转人工提示语',
    botWebhookEnabled: '启用机器人 Webhook', botWebhookUrl: '机器人 Webhook 地址',
  },
  'smtp-email': {
    smtpHost: 'SMTP 主机', smtpPort: 'SMTP 端口', smtpSecure: '启用隐式 TLS（SSL）', smtpUser: 'SMTP 用户名',
    smtpPass: 'SMTP 密码', fromEmail: '发件人邮箱', fromName: '发件人名称', replyTo: '回复地址',
    smtpTestSubject: '测试邮件主题模板', smtpTestText: '测试邮件纯文本模板', smtpTestHtml: '测试邮件 HTML 模板',
  },
  stripe: {
    mode: { label: '当前 Stripe 模式', description: '测试模式用于沙箱支付；正式模式会产生真实扣款。' },
    secretKey: { label: 'Stripe 密钥', description: '服务端凭据。粘贴标准密钥（sk_...）或最小权限的受限密钥（rk_...），不要填到可发布密钥里。' },
    testSecretKey: '测试密钥', testPublishableKey: '测试可发布密钥', testWebhookSecret: '测试 Webhook 签名密钥',
    liveSecretKey: '正式密钥', livePublishableKey: '正式可发布密钥', liveWebhookSecret: '正式 Webhook 签名密钥',
    publishableKey: { label: 'Stripe 可发布密钥', description: '来自 Stripe 控制台「开发者 → API 密钥」的浏览器端公钥，以 pk_ 开头；不要粘贴 sk_ 或 rk_ 密钥。' },
    webhookSecret: { label: 'Webhook 签名密钥', description: '本实例 Webhook 端点的签名密钥，从 Stripe 控制台「开发者 → Webhook → 对应端点 → 签名密钥」复制。' },
  },
  shipping: {
    mode: { label: '承运商环境', description: '承运商提供测试环境时使用测试接口。' },
    kuaidi100Enabled: '启用快递100', kuaidi100Key: '快递100 Key', kuaidi100Customer: '快递100 Customer ID',
    kuaidi100Secret: '快递100 Secret', kuaidi100CallbackSalt: '快递100 回调盐值',
    kuaidi100ApiBaseUrl: '快递100 API 地址', kuaidi100PollBaseUrl: '快递100 轮询地址', kuaidi100CallbackUrl: '快递100 回调地址',
    fourpxEnabled: '启用 4PX', fourpxAppKey: '4PX App Key', fourpxAppSecret: '4PX App Secret',
    fourpxAccessToken: '4PX Access Token', fourpxLanguage: '4PX 返回语言',
  },
  'imager-ai': {
    baseUrl: '服务商接口地址', model: '模型', apiKey: '服务商 API 密钥', creditCost: '每次生成消耗额度',
  },
  odoo: {
    baseUrl: 'Odoo 地址', database: '数据库', username: '用户名', apiKey: 'API 密钥', webhookSecret: '履约 Webhook 密钥',
  },
  'google-auth': {
    clientId: 'Google OAuth 客户端 ID', clientSecret: 'Google OAuth 客户端密钥',
    androidClientId: 'Android 客户端 ID（App 令牌校验）', iosClientId: 'iOS 客户端 ID（App 令牌校验）',
  },
  'facebook-auth': { appId: 'Facebook 应用 ID', appSecret: 'Facebook 应用密钥' },
  'apple-auth': {
    servicesId: 'Services ID（网页端）', teamId: 'Apple 开发者 Team ID', keyId: 'Key ID（.p8 密钥）',
    privateKey: '私钥（.p8 内容）', bundleId: 'App Bundle ID（App 令牌校验）',
  },
};

const CONFIG_FIELDS_ZH_HANT: Record<string, Record<string, ConfigFieldLocalization>> = {
  'support-hub': {
    enabled: '啟用 Support Hub',
    telegramEnabled: '啟用 Telegram', telegramLink: 'Telegram 連結',
    whatsappEnabled: '啟用 WhatsApp', whatsappLink: 'WhatsApp 連結',
    feishuEnabled: '啟用飛書 / Lark', feishuLink: '飛書 / Lark 連結',
    httpsChatEnabled: '啟用網頁聊天', httpsChatUrl: '網頁聊天網址',
    retentionDays: '對話保留天數', autoAssign: '自動分配', defaultQueue: '預設佇列',
    chatEnabled: '啟用客服聊天', aiEnabled: '啟用 AI 回覆', aiProvider: 'AI 服務商',
    aiBaseUrl: 'AI 介面網址', aiApiKey: 'AI API 金鑰', aiModel: 'AI 模型',
    aiSystemPrompt: 'AI 系統提示詞', aiWelcomeMessage: '聊天歡迎語', aiHandoffMessage: '轉人工提示語',
    botWebhookEnabled: '啟用機器人 Webhook', botWebhookUrl: '機器人 Webhook 網址',
  },
  'smtp-email': {
    smtpHost: 'SMTP 主機', smtpPort: 'SMTP 連接埠', smtpSecure: '啟用隱含 TLS（SSL）', smtpUser: 'SMTP 使用者名稱',
    smtpPass: 'SMTP 密碼', fromEmail: '寄件者信箱', fromName: '寄件者名稱', replyTo: '回覆地址',
    smtpTestSubject: '測試郵件主旨範本', smtpTestText: '測試郵件純文字範本', smtpTestHtml: '測試郵件 HTML 範本',
  },
  stripe: {
    mode: { label: '目前的 Stripe 模式', description: '測試模式用於沙箱付款；正式模式會產生真實扣款。' },
    secretKey: { label: 'Stripe 金鑰', description: '伺服器端憑證。貼上標準金鑰（sk_...）或最小權限的受限金鑰（rk_...），不要填到可發布金鑰欄位。' },
    testSecretKey: '測試金鑰', testPublishableKey: '測試可發布金鑰', testWebhookSecret: '測試 Webhook 簽章金鑰',
    liveSecretKey: '正式金鑰', livePublishableKey: '正式可發布金鑰', liveWebhookSecret: '正式 Webhook 簽章金鑰',
    publishableKey: { label: 'Stripe 可發布金鑰', description: '來自 Stripe 控制台「開發者 → API 金鑰」的瀏覽器端公鑰，以 pk_ 開頭；不要貼上 sk_ 或 rk_ 金鑰。' },
    webhookSecret: { label: 'Webhook 簽章金鑰', description: '本實例 Webhook 端點的簽章金鑰，從 Stripe 控制台「開發者 → Webhook → 對應端點 → 簽章金鑰」複製。' },
  },
  shipping: {
    mode: { label: '承運商環境', description: '承運商提供測試環境時使用測試介面。' },
    kuaidi100Enabled: '啟用快遞100', kuaidi100Key: '快遞100 Key', kuaidi100Customer: '快遞100 Customer ID',
    kuaidi100Secret: '快遞100 Secret', kuaidi100CallbackSalt: '快遞100 回呼鹽值',
    kuaidi100ApiBaseUrl: '快遞100 API 網址', kuaidi100PollBaseUrl: '快遞100 輪詢網址', kuaidi100CallbackUrl: '快遞100 回呼網址',
    fourpxEnabled: '啟用 4PX', fourpxAppKey: '4PX App Key', fourpxAppSecret: '4PX App Secret',
    fourpxAccessToken: '4PX Access Token', fourpxLanguage: '4PX 回傳語言',
  },
  'imager-ai': {
    baseUrl: '服務商介面網址', model: '模型', apiKey: '服務商 API 金鑰', creditCost: '每次生成消耗額度',
  },
  odoo: {
    baseUrl: 'Odoo 網址', database: '資料庫', username: '使用者名稱', apiKey: 'API 金鑰', webhookSecret: '履約 Webhook 金鑰',
  },
  'google-auth': {
    clientId: 'Google OAuth 用戶端 ID', clientSecret: 'Google OAuth 用戶端金鑰',
    androidClientId: 'Android 用戶端 ID（App 權杖驗證）', iosClientId: 'iOS 用戶端 ID（App 權杖驗證）',
  },
  'facebook-auth': { appId: 'Facebook 應用程式 ID', appSecret: 'Facebook 應用程式金鑰' },
  'apple-auth': {
    servicesId: 'Services ID（網頁端）', teamId: 'Apple 開發者 Team ID', keyId: 'Key ID（.p8 金鑰）',
    privateKey: '私鑰（.p8 內容）', bundleId: 'App Bundle ID（App 權杖驗證）',
  },
};

function resolveConfigField(
  slug: string,
  field: string,
  locale?: string,
): ConfigFieldLocalization | undefined {
  if (!locale || !locale.startsWith('zh')) return undefined;
  const table = locale === 'zh-Hant' ? CONFIG_FIELDS_ZH_HANT : CONFIG_FIELDS_ZH_HANS;
  return table[slug]?.[field];
}

export function localizePluginConfigLabel(slug: string, field: string, fallback: string, locale?: string): string {
  const overlay = resolveConfigField(slug, field, locale);
  return typeof overlay === 'string' ? overlay : overlay?.label ?? fallback;
}

export function localizePluginConfigDescription(slug: string, field: string, fallback: string, locale?: string): string {
  const overlay = resolveConfigField(slug, field, locale);
  return typeof overlay === 'object' ? overlay.description ?? fallback : fallback;
}

/**
 * Human labels for enumerated config options whose raw values are technical
 * identifiers ("live", "cn"). Options without an entry show their raw value.
 */
const CONFIG_OPTIONS: Record<string, Record<string, Record<string, string>>> = {
  stripe: { mode: { test: 'Test mode', live: 'Live mode' } },
  shipping: { mode: { test: 'Test', live: 'Live' }, fourpxLanguage: { cn: 'Chinese', en: 'English' } },
};

const CONFIG_OPTIONS_ZH_HANS: Record<string, Record<string, Record<string, string>>> = {
  stripe: { mode: { test: '测试模式', live: '正式模式' } },
  shipping: { mode: { test: '测试', live: '正式' }, fourpxLanguage: { cn: '中文', en: 'English' } },
};

const CONFIG_OPTIONS_ZH_HANT: Record<string, Record<string, Record<string, string>>> = {
  stripe: { mode: { test: '測試模式', live: '正式模式' } },
  shipping: { mode: { test: '測試', live: '正式' }, fourpxLanguage: { cn: '中文', en: 'English' } },
};

export function localizePluginConfigOption(slug: string, field: string, option: string, locale?: string): string {
  const zhTable = !locale || !locale.startsWith('zh')
    ? undefined
    : locale === 'zh-Hant' ? CONFIG_OPTIONS_ZH_HANT : CONFIG_OPTIONS_ZH_HANS;
  return zhTable?.[slug]?.[field]?.[option] ?? CONFIG_OPTIONS[slug]?.[field]?.[option] ?? option;
}

export function localizeExtensionName(slug: string, fallback: string, locale?: string): string {
  if (!locale || !locale.startsWith('zh')) return fallback;
  const table = locale === 'zh-Hant' ? ZH_HANT : ZH_HANS;
  return table[slug]?.name ?? fallback;
}

export function localizeExtensionDescription(slug: string, fallback: string, locale?: string): string {
  if (!locale || !locale.startsWith('zh')) return fallback;
  const table = locale === 'zh-Hant' ? ZH_HANT : ZH_HANS;
  return table[slug]?.description ?? fallback;
}

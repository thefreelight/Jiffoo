# 🌍 Jiffoo Mall 国际化 (i18n) 使用指南

## 📋 概述

Jiffoo Mall 提供了完整的国际化支持，支持多语言界面、本地化数据格式和用户偏好设置。系统支持 15 种语言，默认启用 6 种主要语言。

## 🌐 支持的语言

### 默认启用的语言
- 🇨🇳 **简体中文** (zh-CN) - 默认语言
- 🇺🇸 **美式英语** (en-US) - 回退语言
- 🇯🇵 **日语** (ja-JP)
- 🇰🇷 **韩语** (ko-KR)
- 🇪🇸 **西班牙语** (es-ES)
- 🇫🇷 **法语** (fr-FR)

### 可扩展的语言
- 🇹🇼 繁体中文 (zh-TW)
- 🇬🇧 英式英语 (en-GB)
- 🇩🇪 德语 (de-DE)
- 🇮🇹 意大利语 (it-IT)
- 🇧🇷 巴西葡萄牙语 (pt-BR)
- 🇷🇺 俄语 (ru-RU)
- 🇸🇦 阿拉伯语 (ar-SA) - 支持 RTL
- 🇹🇭 泰语 (th-TH)
- 🇻🇳 越南语 (vi-VN)

## 🚀 快速开始

### 1. 获取支持的语言列表

```bash
curl http://localhost:3001/api/i18n/languages
```

### 2. 获取翻译

```bash
# 获取中文翻译
curl "http://localhost:3001/api/i18n/translate/save?lang=zh-CN"

# 获取英文翻译
curl "http://localhost:3001/api/i18n/translate/save?lang=en-US"

# 指定命名空间
curl "http://localhost:3001/api/i18n/translate/login?lang=ko-KR&namespace=auth"
```

### 3. 批量获取翻译

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"keys":["save","cancel","delete"],"namespace":"common"}' \
  "http://localhost:3001/api/i18n/translate/batch?lang=ja-JP"
```

## 🔧 API 使用

### 语言检测

系统会按以下优先级检测用户语言：
1. **查询参数**: `?lang=zh-CN`
2. **Cookie**: `language=zh-CN`
3. **Accept-Language 头**: `Accept-Language: zh-CN,en;q=0.9`
4. **默认语言**: `zh-CN`

### 在代码中使用翻译

```typescript
// 在路由处理器中
app.get('/api/example', async (request, reply) => {
  // 使用 request.t() 函数获取翻译
  const message = await request.t('common.welcome', {
    defaultValue: 'Welcome',
    interpolations: { name: 'John' }
  });
  
  return { message };
});

// 获取用户语言信息
const languageInfo = request.getLanguageInfo();
console.log(languageInfo.nativeName); // "简体中文"

// 切换语言
request.changeLanguage('en-US');
```

### 翻译键命名规范

```typescript
// 命名空间.功能.具体键
'common.save'           // 通用保存按钮
'auth.login'           // 登录相关
'product.add_to_cart'  // 商品相关
'validation.required_field' // 验证消息
'error.not_found'      // 错误消息
```

## 📊 管理功能

### 获取翻译统计

```bash
# 需要管理员权限
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:3001/api/i18n/stats
```

### 用户语言偏好

```bash
# 获取用户偏好
curl -H "Authorization: Bearer <user_token>" \
  http://localhost:3001/api/i18n/user/preferences

# 更新用户偏好
curl -X PUT -H "Authorization: Bearer <user_token>" \
  -H "Content-Type: application/json" \
  -d '{"preferredLanguage":"ja-JP","timezone":"Asia/Tokyo"}' \
  http://localhost:3001/api/i18n/user/preferences
```

### 语言切换

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"language":"ko-KR"}' \
  http://localhost:3001/api/i18n/language/switch
```

## 🛠️ 开发指南

### 添加新的翻译键

```typescript
// 1. 在数据库中创建翻译键
await prisma.translationKey.create({
  data: {
    key: 'product.out_of_stock',
    namespace: 'product',
    description: '商品缺货提示',
    defaultValue: 'Out of stock'
  }
});

// 2. 为每种语言添加翻译
await prisma.translation.create({
  data: {
    key: 'product.out_of_stock',
    namespace: 'product',
    language: 'zh-CN',
    value: '库存不足',
    isApproved: true
  }
});
```

### 使用插值和复数

```typescript
// 插值示例
const message = await request.t('order.items_count', {
  interpolations: { count: 5, total: 100 },
  defaultValue: 'You have {{count}} items out of {{total}}'
});

// 复数形式（英语）
const pluralMessage = await request.t('product.reviews', {
  count: 5,
  defaultValue: '1 review|{{count}} reviews'
});
```

### 本地化数据格式

```typescript
// 根据语言格式化价格
function formatPrice(amount: number, language: string): string {
  switch (language) {
    case 'zh-CN':
      return `¥${amount}`;
    case 'en-US':
      return `$${Math.round(amount / 7)}`;
    case 'ja-JP':
      return `¥${Math.round(amount * 15)}`;
    case 'ko-KR':
      return `₩${Math.round(amount * 180)}`;
    case 'es-ES':
    case 'fr-FR':
      return `€${Math.round(amount / 8)}`;
    default:
      return `¥${amount}`;
  }
}

// 格式化日期
function formatDate(date: Date, language: string): string {
  return date.toLocaleDateString(language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
```

## 🎯 最佳实践

### 1. 翻译键设计

```typescript
// ✅ 好的命名
'common.save'
'auth.login_success'
'product.add_to_cart'
'validation.email_invalid'

// ❌ 避免的命名
'save_button'
'msg1'
'text_here'
'login_ok'
```

### 2. 默认值设置

```typescript
// ✅ 总是提供默认值
const text = await request.t('new.feature', {
  defaultValue: 'New Feature'
});

// ❌ 没有默认值可能导致显示键名
const text = await request.t('new.feature');
```

### 3. 命名空间组织

```typescript
// 按功能模块组织
TranslationNamespace.COMMON    // 通用元素
TranslationNamespace.AUTH      // 认证相关
TranslationNamespace.PRODUCT   // 商品相关
TranslationNamespace.ORDER     // 订单相关
TranslationNamespace.ERROR     // 错误消息
TranslationNamespace.VALIDATION // 验证消息
```

### 4. 性能优化

```typescript
// ✅ 使用批量翻译
const translations = await I18nService.translateBatch(
  ['save', 'cancel', 'delete'],
  'zh-CN',
  'common'
);

// ❌ 避免多次单独调用
const save = await I18nService.translate({ key: 'save' });
const cancel = await I18nService.translate({ key: 'cancel' });
const delete = await I18nService.translate({ key: 'delete' });
```

## 🔍 调试和测试

### 检查翻译覆盖率

```bash
# 获取翻译统计
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:3001/api/i18n/stats
```

### 测试不同语言

```bash
# 测试中文
curl -H "Accept-Language: zh-CN" http://localhost:3001/api/products

# 测试英文
curl -H "Accept-Language: en-US" http://localhost:3001/api/products

# 测试日文
curl -H "Accept-Language: ja-JP" http://localhost:3001/api/products
```

### 健康检查

```bash
curl http://localhost:3001/api/i18n/health
```

## 📈 扩展和维护

### 添加新语言

1. 在 `SupportedLanguage` 枚举中添加语言代码
2. 在 `languageInfo` 中添加语言信息
3. 更新配置中的 `supportedLanguages` 数组
4. 为所有现有翻译键添加新语言的翻译

### 翻译工作流

1. **开发阶段**: 使用默认值进行开发
2. **翻译阶段**: 专业翻译人员添加翻译
3. **审核阶段**: 设置 `isApproved: true`
4. **发布阶段**: 翻译自动生效

### 监控和维护

- 定期检查翻译完成度
- 监控缺失的翻译键
- 更新过时的翻译内容
- 收集用户反馈改进翻译质量

## 🌟 高级功能

### RTL 语言支持

```typescript
// 检查语言方向
const languageInfo = request.getLanguageInfo();
if (languageInfo.direction === 'rtl') {
  // 应用 RTL 样式
}
```

### 动态语言加载

```typescript
// 动态加载语言包
const translations = await I18nService.translateBatch(
  Object.keys(CommonTranslationKeys),
  request.language
);
```

### 翻译缓存策略

- 翻译结果自动缓存 1 小时
- 支持缓存预热和失效
- 批量操作优化性能

通过这个完整的国际化系统，Jiffoo Mall 可以轻松支持全球用户，提供本地化的购物体验！🌍

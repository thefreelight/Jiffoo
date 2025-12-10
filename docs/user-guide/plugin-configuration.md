# 插件配置指南

## 插件商城

访问路径：`商户后台 → 插件商城`

### 浏览插件

插件分类：
- 💳 支付插件
- 📧 邮件插件
- 🔐 登录插件
- 📊 分析插件
- 🎯 营销插件

### 安装插件

1. 选择需要的插件
2. 查看插件详情和定价
3. 点击 **安装** 或 **订阅**
4. 完成支付 (付费插件)
5. 配置插件参数

## 支付插件

### Stripe 支付

**安装步骤：**

1. 安装 Stripe 插件
2. 获取 Stripe API 密钥：
   - 登录 [Stripe Dashboard](https://dashboard.stripe.com)
   - 进入 **Developers** → **API keys**
   - 复制 Secret key

3. 配置插件：
```
插件设置 → Stripe
- Secret Key: sk_live_xxx
- Webhook Secret: whsec_xxx
```

4. 配置 Webhook：
   - 在 Stripe 添加 Webhook 端点
   - URL: `https://api.yourdomain.com/api/plugins/stripe/api/webhook`
   - 事件: `checkout.session.completed`, `payment_intent.succeeded`

### 支付测试

使用 Stripe 测试卡：
- 卡号: `4242 4242 4242 4242`
- 有效期: 任意未来日期
- CVC: 任意3位数

## 邮件插件

### Resend 邮件

**安装步骤：**

1. 安装 Resend 插件
2. 获取 API Key：
   - 登录 [Resend](https://resend.com)
   - 创建 API Key

3. 配置插件：
```
插件设置 → Resend
- API Key: re_xxx
- From Email: noreply@yourdomain.com
- From Name: Your Store
```

4. 验证域名 (可选但推荐)

### 邮件模板

支持自定义模板：
- 订单确认
- 发货通知
- 密码重置
- 营销邮件

## 登录插件

### Google OAuth

**安装步骤：**

1. 安装 Google OAuth 插件
2. 创建 Google OAuth 应用：
   - 访问 [Google Cloud Console](https://console.cloud.google.com)
   - 创建项目
   - 启用 Google+ API
   - 创建 OAuth 2.0 凭据

3. 配置回调 URL：
```
https://api.yourdomain.com/api/plugins/google/api/auth/callback
```

4. 配置插件：
```
插件设置 → Google OAuth
- Client ID: xxx.apps.googleusercontent.com
- Client Secret: xxx
```

## 分销插件

### Affiliate 分销

**功能：**
- 邀请码生成
- 佣金计算
- 多级分销
- 提现管理

**配置：**
```
插件设置 → Affiliate
- 默认佣金比例: 10%
- 结算周期: 7天
- 最低提现: $50
```

**使用流程：**
1. 用户生成邀请链接
2. 新用户通过链接注册
3. 新用户下单后计算佣金
4. 佣金进入待结算
5. 结算周期后可提现

## 插件管理

### 已安装插件

```
插件管理 → 已安装
```

操作：
- 启用/禁用
- 配置参数
- 查看使用量
- 卸载插件

### 订阅管理

```
插件管理 → 订阅
```

查看：
- 当前订阅
- 到期时间
- 使用量统计
- 续费/升级

### 使用量限制

部分插件有使用量限制：
- API 调用次数
- 邮件发送数量
- 存储空间

超出限制后需要升级套餐。

## 故障排除

### 插件无法安装
- 检查网络连接
- 确认订阅状态
- 查看错误日志

### 插件配置无效
- 验证 API 密钥
- 检查回调 URL
- 确认权限设置

### 联系支持
如遇问题，请联系：support@jiffoo.com


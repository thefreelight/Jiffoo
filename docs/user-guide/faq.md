# 常见问题 (FAQ)

## 安装部署

### Q: 系统最低配置要求是什么？

**推荐配置：**
- CPU: 2核+
- 内存: 4GB+
- 硬盘: 20GB+
- 系统: Ubuntu 20.04+ / CentOS 8+

**最低配置：**
- CPU: 1核
- 内存: 2GB
- 硬盘: 10GB

### Q: 支持哪些数据库？

目前仅支持 **PostgreSQL 15+**。

### Q: 可以使用 MySQL 吗？

暂不支持。PostgreSQL 提供更好的 JSON 支持和性能。

### Q: 如何升级系统版本？

```bash
# Docker 部署
docker-compose pull
docker-compose up -d
docker-compose exec api npx prisma migrate deploy

# 手动部署
git pull
pnpm install
pnpm build
pm2 restart all
```

## 商户管理

### Q: 如何创建新商户？

超级管理后台 → 租户管理 → 添加租户

### Q: 商户数量有限制吗？

开源版无限制。商业版根据授权确定。

### Q: 如何为商户绑定独立域名？

1. 商户设置域名
2. DNS 解析到服务器
3. 配置 SSL 证书
4. 系统自动识别

### Q: 商户数据如何隔离？

系统采用租户 ID 隔离，每个商户数据完全独立。

## 支付相关

### Q: 支持哪些支付方式？

通过插件支持：
- Stripe (信用卡)
- PayPal
- 微信支付
- 支付宝

### Q: 如何配置 Stripe？

1. 安装 Stripe 插件
2. 填入 API 密钥
3. 配置 Webhook
4. 测试支付流程

详见 [插件配置指南](./plugin-configuration.md)

### Q: 支付失败怎么办？

1. 检查 API 密钥是否正确
2. 确认 Webhook 配置
3. 查看支付日志
4. 联系支付服务商

## 订单管理

### Q: 订单状态有哪些？

- 待付款
- 待发货
- 已发货
- 已完成
- 已取消
- 已退款

### Q: 如何处理退款？

1. 进入订单详情
2. 点击退款
3. 选择退款金额
4. 确认退款

退款会原路返回。

### Q: 订单数据可以导出吗？

可以。订单管理 → 导出 → 选择格式 (CSV/Excel)

## 商品管理

### Q: 商品数量有限制吗？

无限制，但建议单商户不超过 10 万 SKU。

### Q: 支持多规格商品吗？

支持。可设置颜色、尺寸等多个规格维度。

### Q: 如何批量导入商品？

商品管理 → 导入 → 下载模板 → 填写数据 → 上传

## 主题定制

### Q: 可以自定义主题吗？

可以。支持：
- 颜色定制
- 字体设置
- 布局调整
- 自定义 CSS

### Q: 如何开发自定义主题？

参考 [主题开发指南](../developer/theme-development.md)

## 插件系统

### Q: 如何开发自定义插件？

参考 [插件开发指南](../developer/plugin-development.md)

### Q: 插件收费吗？

部分插件免费，部分需要订阅。

## 性能优化

### Q: 如何提升系统性能？

1. 启用 Redis 缓存
2. 配置 CDN
3. 优化数据库索引
4. 使用负载均衡

### Q: 支持集群部署吗？

支持。API 服务可水平扩展。

## 安全相关

### Q: 数据如何加密？

- 密码: bcrypt 加密
- 传输: HTTPS
- 敏感数据: AES 加密

### Q: 如何备份数据？

```bash
# 数据库备份
pg_dump -U postgres jiffoo_mall > backup.sql

# 文件备份
tar -czvf uploads.tar.gz uploads/
```

## 获取帮助

### 文档
- [官方文档](https://docs.jiffoo.com)

### 社区
- [GitHub Issues](https://github.com/jiffoo/mall/issues)
- [Discord](https://discord.gg/jiffoo)

### 商业支持
- Email: support@jiffoo.com


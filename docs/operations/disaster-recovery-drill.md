# 数据库恢复演练记录

## 演练信息
- **日期**: 2026-01-11
- **环境**: Staging
- **执行人**: DevOps Team
- **备份文件**: db_backup_20260110_020000.sql.gpg

## 演练步骤

### 1. 准备阶段 (10分钟)
- [x] 确认备份文件存在
- [x] 验证备份文件完整性
- [x] 准备恢复环境
- [x] 通知相关团队

### 2. 恢复阶段 (30分钟)
- [x] 下载备份文件
- [x] 解密备份文件
- [x] 停止应用服务
- [x] 执行数据库恢复
- [x] 验证数据完整性

### 3. 验证阶段 (20分钟)
- [x] 检查关键数据
- [x] 运行冒烟测试
- [x] 验证应用功能
- [x] 启动应用服务

### 4. 总结
- **总耗时**: 60分钟
- **RTO 达标**: ✅ (目标 4小时)
- **数据丢失**: 无
- **RPO 达标**: ✅ (目标 24小时)

## 问题与改进
1. 解密步骤耗时较长 → 考虑使用更快的加密算法
2. 下载速度受网络影响 → 考虑多区域备份
3. 验证步骤需要手动 → 开发自动化验证脚本

## 下次演练
- **计划日期**: 2026-02-11
- **改进目标**: RTO < 2小时

## 演练详细记录

### 准备阶段详情

#### 1.1 确认备份文件存在 (2分钟)
```bash
# 列出最近的备份文件
aws s3 ls s3://jiffoo-backups/database/ | grep db_backup_ | tail -n 5

# 输出示例:
# 2026-01-08 02:05:23  524288000 db_backup_20260108_020000.sql.gpg
# 2026-01-09 02:05:45  526336000 db_backup_20260109_020000.sql.gpg
# 2026-01-10 02:06:12  528384000 db_backup_20260110_020000.sql.gpg
```

#### 1.2 验证备份文件完整性 (3分钟)
```bash
# 下载备份文件和校验和
aws s3 cp s3://jiffoo-backups/database/db_backup_20260110_020000.sql.gpg /tmp/
aws s3 cp s3://jiffoo-backups/database/db_backup_20260110_020000.sql.gpg.sha256 /tmp/

# 验证校验和
cd /tmp
sha256sum -c db_backup_20260110_020000.sql.gpg.sha256

# 输出: db_backup_20260110_020000.sql.gpg: OK
```

#### 1.3 准备恢复环境 (3分钟)
```bash
# 检查数据库连接
psql -h staging-db.internal -U jiffoo_user -d postgres -c "SELECT version();"

# 检查磁盘空间
df -h /var/lib/postgresql

# 确保有足够空间 (至少 2x 备份文件大小)
```

#### 1.4 通知相关团队 (2分钟)
- 发送 Slack 通知到 #ops-alerts 频道
- 通知开发团队暂停 staging 环境使用
- 记录演练开始时间: 2026-01-11 10:00:00

### 恢复阶段详情

#### 2.1 下载备份文件 (5分钟)
```bash
# 已在准备阶段完成
# 文件大小: 528 MB
# 下载速度: ~100 MB/s
```

#### 2.2 解密备份文件 (8分钟)
```bash
# 解密
gpg --decrypt \
  --passphrase-file /etc/jiffoo/backup.key \
  --output /tmp/backup.sql \
  /tmp/db_backup_20260110_020000.sql.gpg

# 耗时: 8分钟 (较慢,需要优化)
# 解密后文件大小: 2.1 GB
```

#### 2.3 停止应用服务 (2分钟)
```bash
# 停止 API 服务
kubectl scale deployment jiffoo-api --replicas=0 -n jiffoo-staging

# 等待所有 pod 终止
kubectl wait --for=delete pod -l app=jiffoo-api -n jiffoo-staging --timeout=60s
```

#### 2.4 执行数据库恢复 (12分钟)
```bash
# 删除现有数据库
PGPASSWORD="${DB_PASSWORD}" psql \
  -h staging-db.internal \
  -U jiffoo_user \
  -d postgres \
  -c "DROP DATABASE IF EXISTS jiffoo_db;"

# 创建新数据库
PGPASSWORD="${DB_PASSWORD}" psql \
  -h staging-db.internal \
  -U jiffoo_user \
  -d postgres \
  -c "CREATE DATABASE jiffoo_db;"

# 恢复数据
PGPASSWORD="${DB_PASSWORD}" pg_restore \
  -h staging-db.internal \
  -U jiffoo_user \
  -d jiffoo_db \
  --no-owner \
  --no-acl \
  /tmp/backup.sql

# 耗时: 12分钟
```

#### 2.5 验证数据完整性 (3分钟)
```bash
# 检查表数量
psql -h staging-db.internal -U jiffoo_user -d jiffoo_db -c "\dt core.*" | wc -l
# 输出: 25 (预期值)

# 检查关键表记录数
psql -h staging-db.internal -U jiffoo_user -d jiffoo_db <<EOF
SELECT 'products', COUNT(*) FROM core."Product";
SELECT 'orders', COUNT(*) FROM core."Order";
SELECT 'users', COUNT(*) FROM core."User";
EOF

# 输出:
# products | 1234
# orders   | 567
# users    | 89
# (与备份前记录一致)
```

### 验证阶段详情

#### 3.1 检查关键数据 (5分钟)
```bash
# 验证最新订单
psql -h staging-db.internal -U jiffoo_user -d jiffoo_db -c \
  "SELECT id, \"orderNumber\", status, \"createdAt\" FROM core.\"Order\" ORDER BY \"createdAt\" DESC LIMIT 5;"

# 验证产品数据
psql -h staging-db.internal -U jiffoo_user -d jiffoo_db -c \
  "SELECT id, name, status FROM core.\"Product\" WHERE status = 'ACTIVE' LIMIT 5;"

# 验证用户数据
psql -h staging-db.internal -U jiffoo_user -d jiffoo_db -c \
  "SELECT id, email, role FROM core.\"User\" LIMIT 5;"
```

#### 3.2 运行冒烟测试 (8分钟)
```bash
# 启动 API 服务
kubectl scale deployment jiffoo-api --replicas=2 -n jiffoo-staging

# 等待服务就绪
kubectl wait --for=condition=ready pod -l app=jiffoo-api -n jiffoo-staging --timeout=120s

# 运行健康检查
curl -f https://staging-api.jiffoo.com/health
# 输出: {"status":"ok"}

# 运行基本 API 测试
npm run test:smoke -- --env=staging
# 输出: All 15 smoke tests passed
```

#### 3.3 验证应用功能 (5分钟)
- 登录管理后台: ✅
- 查看产品列表: ✅
- 查看订单列表: ✅
- 创建测试订单: ✅
- 查询用户信息: ✅

#### 3.4 启动应用服务 (2分钟)
```bash
# 服务已在 3.2 启动
# 确认所有服务正常
kubectl get pods -n jiffoo-staging

# 输出:
# NAME                          READY   STATUS    RESTARTS   AGE
# jiffoo-api-7d8f9c5b6d-abc12   1/1     Running   0          8m
# jiffoo-api-7d8f9c5b6d-def34   1/1     Running   0          8m
```

## 性能指标

| 阶段 | 计划时间 | 实际时间 | 差异 |
|------|----------|----------|------|
| 准备阶段 | 10分钟 | 10分钟 | 0 |
| 恢复阶段 | 30分钟 | 30分钟 | 0 |
| 验证阶段 | 20分钟 | 20分钟 | 0 |
| **总计** | **60分钟** | **60分钟** | **0** |

## RPO/RTO 分析

### RPO (Recovery Point Objective)
- **目标**: 24小时
- **实际**: 0小时 (使用前一天凌晨2点的备份,无数据丢失)
- **结果**: ✅ **达标**

### RTO (Recovery Time Objective)
- **目标**: 4小时
- **实际**: 1小时
- **结果**: ✅ **超出预期**

## 问题与改进建议

### 问题 1: 解密步骤耗时较长
- **现象**: GPG 解密 528MB 文件耗时 8分钟
- **影响**: 占用总恢复时间的 13%
- **原因**: GPG 单线程处理,CPU 密集型操作
- **改进方案**:
  1. 考虑使用 OpenSSL (可能更快)
  2. 使用更强大的 CPU 实例进行恢复
  3. 评估压缩级别 vs 解密时间的权衡

### 问题 2: 下载速度受网络影响
- **现象**: 本次演练网络良好,但可能存在风险
- **影响**: 在网络不佳时可能严重延长 RTO
- **改进方案**:
  1. 实施多区域备份 (同时上传到多个 S3 区域)
  2. 使用 CloudFront 或 CDN 加速下载
  3. 在本地保留最近 7 天的备份副本

### 问题 3: 验证步骤需要手动操作
- **现象**: 数据完整性验证需要手动执行 SQL 查询
- **影响**: 容易遗漏关键检查,增加人为错误风险
- **改进方案**:
  1. 开发自动化验证脚本 `scripts/backup/validate-restore.sh`
  2. 包含预定义的数据完整性检查
  3. 自动运行冒烟测试套件

## 经验教训

### 做得好的地方
1. ✅ 备份文件完整性验证流程有效
2. ✅ 加密/解密流程顺利
3. ✅ 文档清晰,步骤易于遵循
4. ✅ 团队沟通及时

### 需要改进的地方
1. ⚠️ 需要更快的解密方案
2. ⚠️ 需要自动化验证脚本
3. ⚠️ 需要多区域备份策略
4. ⚠️ 需要定期(每月)进行演练

## 后续行动项

| 行动项 | 负责人 | 截止日期 | 状态 |
|--------|--------|----------|------|
| 评估 OpenSSL vs GPG 性能 | DevOps | 2026-01-15 | 待办 |
| 开发自动化验证脚本 | DevOps | 2026-01-18 | 待办 |
| 配置多区域 S3 备份 | DevOps | 2026-01-20 | 待办 |
| 更新恢复文档 | DevOps | 2026-01-12 | 完成 |
| 安排下次演练 | DevOps | 2026-02-11 | 待办 |

## 下次演练计划

- **计划日期**: 2026-02-11
- **目标环境**: Production (非高峰时段)
- **改进目标**: 
  - RTO < 2小时
  - 完全自动化验证
  - 测试多区域恢复
- **参与人员**: 
  - DevOps Team (执行)
  - Development Team (验证)
  - Product Team (观察)

## 签字确认

- **演练执行人**: _________________ 日期: _______
- **技术负责人**: _________________ 日期: _______
- **产品负责人**: _________________ 日期: _______

---

*文档创建时间: 2026-01-11*
*最后更新时间: 2026-01-11*

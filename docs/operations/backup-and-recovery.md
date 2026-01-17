# Jiffoo Mall - 备份与恢复系统

## 概述

本文档描述 Jiffoo Mall 的备份与灾难恢复系统,包括备份策略、恢复流程和 RPO/RTO 目标。

## RPO/RTO 目标

### Alpha 阶段 (当前)

| 指标 | 目标 | 说明 |
|------|------|------|
| **RPO** (Recovery Point Objective) | 24 小时 | 最多丢失 24 小时数据 |
| **RTO** (Recovery Time Objective) | 4 小时 | 4 小时内恢复服务 |
| **备份频率** | 每日 | 每天凌晨 2:00 自动备份 |
| **备份保留** | 30 天 | 保留最近 30 天的备份 |
| **加密** | AES-256 | 所有备份文件加密 |
| **完整性校验** | SHA-256 | 每个备份文件生成校验和 |

### Beta/GA 阶段 (未来)

| 指标 | 目标 |
|------|------|
| RPO | 1 小时 (增量备份) |
| RTO | 1 小时 |
| 备份频率 | 每小时增量 + 每日全量 |
| 异地备份 | 多区域复制 |

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    备份与恢复架构                             │
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │  PostgreSQL  │      │ File Storage │                    │
│  │   Database   │      │   (S3/MinIO) │                    │
│  └──────┬───────┘      └──────┬───────┘                    │
│         │                     │                            │
│         │ pg_dump             │ tar + gzip                 │
│         ▼                     ▼                            │
│  ┌──────────────────────────────────┐                      │
│  │      Backup Service              │                      │
│  │  - Schedule (cron)               │                      │
│  │  - Encryption (GPG/AES-256)      │                      │
│  │  - Integrity Check (SHA-256)     │                      │
│  │  - Retention Policy (30 days)    │                      │
│  └──────────────┬───────────────────┘                      │
│                 │                                          │
│                 ▼                                          │
│  ┌──────────────────────────────────┐                      │
│  │    Backup Storage (S3/MinIO)     │                      │
│  │  - Encrypted backups             │                      │
│  │  - Checksums                     │                      │
│  │  - Metadata                      │                      │
│  └──────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

## 备份内容

### 1. 数据库备份
- **内容**: 完整的 PostgreSQL 数据库
- **格式**: Custom format (pg_dump)
- **压缩**: Level 9
- **加密**: GPG with AES-256
- **频率**: 每日凌晨 2:00
- **保留**: 30 天

### 2. 文件存储备份
- **内容**: 上传的文件 (产品图片、主题资源等)
- **格式**: tar.gz
- **加密**: GPG with AES-256
- **频率**: 每日凌晨 3:00
- **保留**: 30 天

## 备份脚本

### 数据库备份

```bash
# 手动执行备份
./scripts/backup/backup-database.sh

# 配置环境变量
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=jiffoo_db
export DB_USER=jiffoo_user
export DB_PASSWORD=your_password
export ENCRYPTION_KEY_FILE=/etc/jiffoo/backup.key
export S3_BUCKET=s3://jiffoo-backups
export RETENTION_DAYS=30
```

### 文件存储备份

```bash
# 手动执行备份
./scripts/backup/backup-files.sh

# 配置环境变量
export SOURCE_DIR=/var/lib/jiffoo/uploads
export BACKUP_DIR=/var/backups/jiffoo/files
export S3_BUCKET=s3://jiffoo-backups
export ENCRYPTION_KEY_FILE=/etc/jiffoo/backup.key
export RETENTION_DAYS=30
```

### 备份验证

```bash
# 验证最新备份
./scripts/backup/verify-backups.sh

# 配置环境变量
export S3_BUCKET=s3://jiffoo-backups
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

## 自动化调度

### Cron (Linux/Unix)

```bash
# 安装 cron 任务
sudo cp scripts/backup/jiffoo-backup.cron /etc/cron.d/jiffoo-backup
sudo chmod 644 /etc/cron.d/jiffoo-backup

# 查看 cron 日志
tail -f /var/log/jiffoo/backup-db.log
tail -f /var/log/jiffoo/backup-files.log
tail -f /var/log/jiffoo/backup-verify.log
```

### Kubernetes CronJob

```bash
# 部署 CronJob
kubectl apply -f deploy/k8s/backup-cronjob.yaml

# 查看 CronJob 状态
kubectl get cronjobs -n jiffoo

# 查看最近的备份任务
kubectl get jobs -n jiffoo | grep backup

# 查看备份日志
kubectl logs -n jiffoo job/jiffoo-database-backup-<timestamp>
```

## 恢复流程

### 数据库恢复

```bash
# 从 S3 恢复
./scripts/backup/restore-database.sh s3://jiffoo-backups/database/db_backup_20260111_020000.sql.gpg

# 从本地文件恢复
./scripts/backup/restore-database.sh /var/backups/jiffoo/db_backup_20260111_020000.sql.gpg

# 配置环境变量
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=jiffoo_db
export DB_USER=jiffoo_user
export DB_PASSWORD=your_password
export ENCRYPTION_KEY_FILE=/etc/jiffoo/backup.key
```

### 恢复步骤

1. **准备阶段** (10分钟)
   - 确认备份文件存在
   - 验证备份文件完整性
   - 准备恢复环境
   - 通知相关团队

2. **恢复阶段** (30分钟)
   - 下载备份文件
   - 解密备份文件
   - 停止应用服务
   - 执行数据库恢复
   - 验证数据完整性

3. **验证阶段** (20分钟)
   - 检查关键数据
   - 运行冒烟测试
   - 验证应用功能
   - 启动应用服务

详细的恢复演练记录请参考: [disaster-recovery-drill.md](./disaster-recovery-drill.md)

## 监控与告警

### 备份健康检查

系统会自动监控备份状态:

1. **新鲜度检查**: 确保备份在 26 小时内
2. **完整性检查**: 验证 SHA-256 校验和
3. **告警通知**: 通过 Slack 发送告警

### 配置监控

```typescript
import { BackupMonitor } from '@/services/backup/backup-monitor';

const monitor = new BackupMonitor();

// 检查备份新鲜度
const isFresh = await monitor.checkBackupFreshness();

// 验证备份完整性
const isValid = await monitor.verifyBackupIntegrity('database/db_backup_20260111_020000.sql.gpg');

// 运行完整健康检查
const health = await monitor.runHealthChecks();
```

### 环境变量

```bash
# AWS S3 配置
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export S3_BACKUP_BUCKET=jiffoo-backups

# Slack 告警
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

## 安全性

### 加密密钥管理

1. **生成加密密钥**:
   ```bash
   # 生成随机密钥
   openssl rand -base64 32 > /etc/jiffoo/backup.key
   
   # 设置权限
   chmod 600 /etc/jiffoo/backup.key
   chown jiffoo:jiffoo /etc/jiffoo/backup.key
   ```

2. **Kubernetes Secret**:
   ```bash
   # 创建 Secret
   kubectl create secret generic backup-encryption-key \
     --from-file=backup.key=/etc/jiffoo/backup.key \
     -n jiffoo
   ```

### S3 访问控制

1. **IAM 策略**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:ListBucket",
           "s3:DeleteObject"
         ],
         "Resource": [
           "arn:aws:s3:::jiffoo-backups",
           "arn:aws:s3:::jiffoo-backups/*"
         ]
       }
     ]
   }
   ```

2. **S3 Bucket 策略**:
   - 启用版本控制
   - 启用服务器端加密 (SSE-S3 或 SSE-KMS)
   - 配置生命周期规则 (30 天后删除)

## 测试与验证

### 备份测试

```bash
# 1. 执行备份
./scripts/backup/backup-database.sh

# 2. 验证备份文件
ls -lh /var/backups/jiffoo/

# 3. 验证 S3 上传
aws s3 ls s3://jiffoo-backups/database/ | tail -n 5

# 4. 验证校验和
./scripts/backup/verify-backups.sh
```

### 恢复测试

```bash
# 在测试环境执行恢复
export DB_HOST=test-db.internal
export DB_NAME=jiffoo_test_db

./scripts/backup/restore-database.sh s3://jiffoo-backups/database/db_backup_20260111_020000.sql.gpg
```

## 故障排查

### 常见问题

#### 1. 备份失败: "pg_dump: command not found"

**解决方案**:
```bash
# 安装 PostgreSQL 客户端工具
sudo apt-get install postgresql-client-16
```

#### 2. 加密失败: "gpg: command not found"

**解决方案**:
```bash
# 安装 GPG
sudo apt-get install gnupg
```

#### 3. S3 上传失败: "Unable to locate credentials"

**解决方案**:
```bash
# 配置 AWS 凭证
aws configure

# 或设置环境变量
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
```

#### 4. 解密失败: "gpg: decryption failed: Bad session key"

**解决方案**:
- 确认使用正确的加密密钥文件
- 检查密钥文件权限
- 验证备份文件未损坏

### 日志位置

- 数据库备份日志: `/var/log/jiffoo/backup-db.log`
- 文件备份日志: `/var/log/jiffoo/backup-files.log`
- 验证日志: `/var/log/jiffoo/backup-verify.log`

## 演练计划

### 定期演练

- **频率**: 每月一次
- **环境**: Staging 或 Production (非高峰时段)
- **参与人员**: DevOps Team, Development Team
- **文档**: 记录在 [disaster-recovery-drill.md](./disaster-recovery-drill.md)

### 下次演练

- **计划日期**: 2026-02-11
- **目标**: RTO < 2 小时
- **改进重点**: 自动化验证、多区域恢复

## 相关文档

- [灾难恢复演练记录](./disaster-recovery-drill.md)
- [PRD_EXECUTABLE.md](../../PRD_EXECUTABLE.md) - ALPHA-P0-Q05
- [实施计划](../../.kiro/implementation/stage4-backup-recovery.md)

## 联系方式

- **技术支持**: devops@jiffoo.com
- **紧急联系**: oncall@jiffoo.com
- **Slack**: #ops-alerts

---

*文档创建时间: 2026-01-11*
*最后更新时间: 2026-01-11*

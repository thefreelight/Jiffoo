# 🚀 Jiffoo Mall 部署指南

## 📋 部署前准备

### 系统要求
- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **内存**: 最少 4GB RAM (推荐 8GB+)
- **存储**: 最少 20GB 可用空间
- **CPU**: 2核心以上
- **网络**: 公网IP地址

### 必需软件
```bash
# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

## 🔧 快速部署

### 1. 克隆项目
```bash
git clone https://github.com/your-username/jiffoo-mall-core.git
cd jiffoo-mall-core
```

### 2. 配置环境变量
```bash
# 复制环境变量模板
cp .env.production .env.production.local

# 编辑配置文件
nano .env.production.local
```

**重要配置项**:
```bash
# 数据库密码 (必须修改)
POSTGRES_PASSWORD=your_secure_password_here

# Redis密码 (必须修改)
REDIS_PASSWORD=your_redis_password_here

# JWT密钥 (必须修改，至少32字符)
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters

# 域名配置
DOMAIN=your-domain.com
ADMIN_DOMAIN=admin.your-domain.com

# API地址
NEXT_PUBLIC_API_URL=https://your-domain.com/api
```

### 3. 配置域名
编辑 Nginx 配置文件：
```bash
# 编辑域名配置
nano nginx/conf.d/default.conf

# 将 your-domain.com 替换为您的实际域名
sed -i 's/your-domain.com/yourdomain.com/g' nginx/conf.d/default.conf
```

### 4. 一键部署
```bash
# 运行部署脚本
./deploy.sh
```

### 5. 验证部署
```bash
# 检查服务状态
./scripts/health-check.sh

# 查看运行的容器
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

## 🌐 访问应用

部署成功后，您可以通过以下地址访问：

- **前端商城**: http://your-domain.com
- **管理后台**: http://admin.your-domain.com
- **API文档**: http://your-domain.com/api/docs

## 🔒 SSL证书配置

### 使用 Let's Encrypt (推荐)
```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d your-domain.com -d admin.your-domain.com

# 自动续期
sudo crontab -e
# 添加: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 手动配置SSL
```bash
# 创建SSL目录
mkdir -p ssl

# 复制证书文件
cp your-cert.pem ssl/cert.pem
cp your-key.pem ssl/key.pem

# 取消注释Nginx HTTPS配置
nano nginx/conf.d/default.conf
```

## 📊 监控和维护

### 查看系统状态
```bash
# 服务健康检查
./scripts/health-check.sh

# 查看资源使用
docker stats

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f [service-name]
```

### 备份数据
```bash
# 数据库备份
docker exec jiffoo-postgres pg_dump -U jiffoo jiffoo_mall > backup_$(date +%Y%m%d).sql

# 文件备份
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/
```

### 更新应用
```bash
# 拉取最新代码
git pull origin main

# 重新构建和部署
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 常见问题

### 端口被占用
```bash
# 查看端口占用
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443

# 停止占用端口的服务
sudo systemctl stop apache2  # 如果安装了Apache
sudo systemctl stop nginx    # 如果安装了系统Nginx
```

### 内存不足
```bash
# 增加交换空间
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 数据库连接失败
```bash
# 检查数据库状态
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U jiffoo

# 查看数据库日志
docker-compose -f docker-compose.prod.yml logs postgres
```

## 🚨 安全建议

1. **修改默认密码**: 确保修改所有默认密码
2. **防火墙配置**: 只开放必要端口 (80, 443, 22)
3. **定期更新**: 保持系统和Docker镜像更新
4. **备份策略**: 设置自动备份
5. **监控告警**: 配置服务监控和告警

## 📞 技术支持

如果遇到问题，请：
1. 查看日志文件
2. 运行健康检查脚本
3. 检查GitHub Issues
4. 联系技术支持

---

🎉 **恭喜！您的Jiffoo Mall已成功部署！**

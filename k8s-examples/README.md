# 🚀 Jiffoo Mall Kubernetes 部署指南

这个目录包含了在 Kubernetes 集群中部署 Jiffoo Mall 的示例配置文件。

## 📋 前置要求

- Kubernetes 集群 (v1.20+)
- kubectl 命令行工具
- 至少 4GB 可用内存
- 持久化存储支持

## 🏗️ 部署架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   PostgreSQL    │
│   (React)       │◄──►│   (Fastify)     │◄──►│   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────┐
                    │     Redis       │
                    │    (Cache)      │
                    └─────────────────┘
```

## 🚀 快速部署

### 1. 创建命名空间
```bash
kubectl apply -f namespace.yaml
```

### 2. 部署数据库和缓存
```bash
# 部署 PostgreSQL
kubectl apply -f postgres.yaml

# 部署 Redis
kubectl apply -f redis.yaml
```

### 3. 等待数据库就绪
```bash
kubectl wait --for=condition=ready pod -l app=postgres -n jiffoo-system --timeout=300s
```

### 4. 部署应用
```bash
# 部署后端服务
kubectl apply -f backend-deployment.yaml

# 部署前端服务
kubectl apply -f frontend-deployment.yaml
```

### 5. 验证部署
```bash
kubectl get pods -n jiffoo-system
kubectl get services -n jiffoo-system
```

## 🔧 配置说明

### 数据库配置
- **默认数据库**: `jiffoo_dev`
- **默认用户**: `jiffoo`
- **密码**: 请修改 `postgres.yaml` 中的 `POSTGRES_PASSWORD`

### 存储配置
- 使用 PersistentVolumeClaim 进行数据持久化
- 默认存储大小: 10Gi
- 根据你的存储类调整 `storageClassName`

### 网络配置
- Backend 服务端口: 3000
- Frontend 服务端口: 3001
- 数据库端口: 5432
- Redis 端口: 6379

## 🔌 插件微服务部署

插件可以作为独立的微服务部署：

```bash
kubectl apply -f plugins/example-payment-plugin.yaml
```

### 插件配置
- 每个插件运行在独立的 Pod 中
- 通过 Service 暴露 API 接口
- 支持水平扩展

## 🌐 访问应用

### 本地访问
```bash
# 端口转发到本地
kubectl port-forward service/jiffoo-frontend 3001:3001 -n jiffoo-system
kubectl port-forward service/jiffoo-backend 3000:3000 -n jiffoo-system
```

然后访问: http://localhost:3001

### 生产环境
配置 Ingress 或 LoadBalancer 服务类型来暴露应用。

## 📊 监控和日志

### 查看日志
```bash
# 查看后端日志
kubectl logs -f deployment/jiffoo-backend -n jiffoo-system

# 查看前端日志
kubectl logs -f deployment/jiffoo-frontend -n jiffoo-system
```

### 监控资源使用
```bash
kubectl top pods -n jiffoo-system
kubectl top nodes
```

## 🔒 安全配置

### 密钥管理
- 数据库密码存储在 Kubernetes Secret 中
- 应用配置通过 ConfigMap 管理
- 建议使用外部密钥管理系统（如 Vault）

### 网络策略
```yaml
# 示例网络策略
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: jiffoo-network-policy
  namespace: jiffoo-system
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

## 🚨 故障排除

### 常见问题

1. **Pod 启动失败**
   ```bash
   kubectl describe pod <pod-name> -n jiffoo-system
   ```

2. **数据库连接失败**
   - 检查数据库 Pod 状态
   - 验证连接字符串和密码

3. **存储问题**
   - 确保集群支持动态存储分配
   - 检查 StorageClass 配置

### 清理部署
```bash
kubectl delete namespace jiffoo-system
kubectl delete namespace jiffoo-plugins
```

## 📚 更多资源

- [Kubernetes 官方文档](https://kubernetes.io/docs/)
- [Jiffoo Mall 项目文档](../README.md)
- [插件开发指南](../docs/plugin-development.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这些部署配置！

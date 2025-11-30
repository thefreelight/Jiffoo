# Jiffoo Mall (Open Source) - Kubernetes 部署指南

## 📋 概述

本目录包含 Jiffoo Mall 开源版的 Kubernetes 部署配置文件。

## 🌐 域名规划

### 内部环境 (VPN 访问)
| 服务 | 域名 | 端口 |
|------|------|------|
| Shop | shop.lafdru.local | 80 |
| API | api.lafdru.local | 80 |
| Admin | admin.lafdru.local | 80 |

### 外部环境 (公网访问)
| 服务 | URL | NodePort |
|------|-----|----------|
| Shop | http://jiffoo.chfastpay.com:31001 | 31001 |
| API | http://jiffoo.chfastpay.com:31002 | 31002 |
| Admin | http://jiffoo.chfastpay.com:31003 | 31003 |

## 📁 文件说明

| 文件 | 说明 |
|------|------|
| `namespace.yaml` | 命名空间定义 |
| `configmap.yaml` | 配置映射 |
| `secrets.yaml` | 敏感信息（需修改默认密码） |
| `postgres.yaml` | PostgreSQL 数据库 |
| `redis.yaml` | Redis 缓存 |
| `api.yaml` | API 后端服务 |
| `shop.yaml` | 商城前端服务 |
| `admin.yaml` | 管理后台服务 |
| `ingress-internal.yaml` | 内部 Ingress（子域名模式） |

## 🚀 快速部署

```bash
# 1. 创建命名空间
kubectl apply -f namespace.yaml

# 2. 部署配置（⚠️ 先修改 secrets.yaml 中的密码！）
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml

# 3. 部署基础设施
kubectl apply -f postgres.yaml
kubectl apply -f redis.yaml

# 4. 等待数据库就绪
kubectl wait --for=condition=ready pod -l app=postgres -n jiffoo-opensource --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis -n jiffoo-opensource --timeout=60s

# 5. 部署应用
kubectl apply -f api.yaml
kubectl apply -f shop.yaml
kubectl apply -f admin.yaml

# 6. 部署内部 Ingress
kubectl apply -f ingress-internal.yaml
```

## 🔧 端口规划

| 端口范围 | 项目 |
|----------|------|
| 30001-30009 | jiffoo-mall-core (商业版) |
| 30030-30101 | 基础设施 (Grafana, Prometheus 等) |
| **31001-31009** | **Jiffoo 开源版** |
| 32xxx | 预留其他项目 |

## ⚠️ 注意事项

1. **修改密码**: 部署前务必修改 `secrets.yaml` 中的默认密码
2. **DNS 配置**: 内部域名需要在 DNS 服务器或 hosts 文件中配置
3. **存储**: PostgreSQL 使用 PVC，确保集群有可用的 StorageClass
4. **镜像仓库**: 默认使用 `harbor.lafdru.local`，根据实际情况修改

## 📊 资源需求

| 组件 | CPU (请求/限制) | 内存 (请求/限制) |
|------|-----------------|------------------|
| API | 250m / 1000m | 256Mi / 1Gi |
| Shop | 200m / 500m | 256Mi / 512Mi |
| Admin | 200m / 500m | 256Mi / 512Mi |
| PostgreSQL | 250m / 1000m | 256Mi / 1Gi |
| Redis | 100m / 500m | 64Mi / 256Mi |

---

**Made with ❤️ by the Jiffoo Team**

# CI/CD 部署指南

## 📋 目录

- [架构概览](#架构概览)
- [关键配置](#关键配置)
- [常见问题](#常见问题)
- [故障排查](#故障排查)
- [部署检查清单](#部署检查清单)

---

## 🏗️ 架构概览

### **基础设施组件**

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Actions CI/CD                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Prepare  │→ │  Build   │→ │ Security │→ │  Deploy  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    ┌──────────────────┐
                    │  Harbor Registry │
                    │  192.168.0.114   │
                    └──────────────────┘
                              ↓
                    ┌──────────────────┐
                    │ Kubernetes Cluster│
                    │   (Qujing)        │
                    │  - Traefik Ingress│
                    │  - NodePort       │
                    └──────────────────┘
```

### **环境说明**

| 环境 | 命名空间 | 访问方式 | 域名/端口 |
|------|---------|---------|----------|
| **Dev** | `jiffoo-mall-core-dev` | NodePort | `jiffoo.chfastpay.com:30001-30009` |
| **Prod** | `jiffoo-mall-core-prod` | Traefik Ingress | `jiffoo.com`, `api.jiffoo.com`, etc. |

---

## 🔑 关键配置

### **1. 镜像仓库配置**

#### ⚠️ **重要：必须保持一致！**

**CI/CD 配置** (`.github/workflows/cicd.yml`):
```yaml
env:
  REGISTRY: 192.168.0.114          # Harbor 内网仓库
  REGISTRY_URL: http://192.168.0.114
  IMAGE_NAME: jiffoo-mall-core
```

**Helm 配置** (`deploy/helm/values.yaml`):
```yaml
global:
  image:
    registry: 192.168.0.114        # ✅ 必须与 CI/CD 一致
    repository: jiffoo-mall-core   # ✅ 必须与 CI/CD 一致
    tag: latest
    pullPolicy: IfNotPresent
  
  imagePullSecrets:
    - name: harbor-registry        # ✅ 使用 Harbor 认证
```

#### ❌ **常见错误**

```yaml
# 错误配置 1: 使用了 GitHub Container Registry
global:
  image:
    registry: ghcr.io              # ❌ 错误！CI/CD 推送到 Harbor
    repository: thefreelight/jiffoo-mall-core
  imagePullSecrets:
    - name: ghcr-secret            # ❌ 错误！应该用 harbor-registry
```

**后果**: `ImagePullBackOff`, `401 Unauthorized`

---

### **2. NodePort 端口映射**

#### **端口映射规则** (`deploy/helm/templates/_helpers.tpl`)

```yaml
{{- define "jiffoo-mall-core.nodePort" -}}
{{- $port := .port | int }}
{{- if eq $port 3001 }}30001{{- end }}  # Frontend
{{- if eq $port 3002 }}30002{{- end }}  # Backend
{{- if eq $port 3003 }}30003{{- end }}  # Admin
{{- if eq $port 3004 }}30004{{- end }}  # Super Admin
{{- if eq $port 3005 }}30005{{- end }}  # Agent Portal
{{- if eq $port 3006 }}30006{{- end }}  # White Label
{{- if eq $port 3007 }}30007{{- end }}  # Distribution
{{- if eq $port 3008 }}30008{{- end }}  # Docs Internal
{{- if eq $port 3009 }}30009{{- end }}  # Docs Public
{{- end }}
```

#### **服务端口配置** (`deploy/helm/values.yaml`)

| 服务 | Service Port | NodePort | 访问 URL |
|------|-------------|----------|----------|
| Frontend | 3001 | 30001 | http://jiffoo.chfastpay.com:30001 |
| Backend | 3002 | 30002 | http://jiffoo.chfastpay.com:30002 |
| Admin | 3003 | 30003 | http://jiffoo.chfastpay.com:30003 |
| Super Admin | 3004 | 30004 | http://jiffoo.chfastpay.com:30004 |
| Agent Portal | 3005 | 30005 | http://jiffoo.chfastpay.com:30005 |
| White Label | 3006 | 30006 | http://jiffoo.chfastpay.com:30006 |
| Distribution | 3007 | 30007 | http://jiffoo.chfastpay.com:30007 |
| Docs Internal | 3008 | 30008 | http://jiffoo.chfastpay.com:30008 |
| Docs Public | 3009 | 30009 | http://jiffoo.chfastpay.com:30009 |

#### ⚠️ **注意事项**

1. **端口号必须一致**：飞书通知、Dashboard、文档中的端口号必须与 Helm 配置一致
2. **大陆访问**：Dev 环境使用 NodePort 而不是 Ingress，因为 DNS 解析问题
3. **端口范围**：NodePort 范围是 30000-32767，我们使用 30001-30009

---

### **3. Ingress Controller 配置**

#### **集群使用 Traefik**（不是 nginx）

**Production 配置** (`deploy/helm/values-prod.yaml`):
```yaml
ingress:
  enabled: true
  className: "traefik"              # ✅ 使用 Traefik
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    traefik.ingress.kubernetes.io/redirect-entry-point: "https"
    traefik.ingress.kubernetes.io/redirect-permanent: "true"
```

**Development 配置** (`deploy/helm/values-dev.yaml`):
```yaml
ingress:
  enabled: false                    # ✅ Dev 环境禁用 Ingress
  className: "traefik"
  # Dev 使用 NodePort 访问（大陆 DNS 问题）
```

#### ❌ **常见错误**

```yaml
# 错误配置: 使用了 nginx
ingress:
  className: "nginx"                # ❌ 错误！集群使用 Traefik
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"  # ❌ 错误！
```

---

## 🐛 常见问题

### **问题 1: ImagePullBackOff / 401 Unauthorized**

**症状**:
```
Error: ErrImagePull
Failed to pull image "192.168.0.114/xxx": 401 Unauthorized
```

**原因**:
- 镜像仓库配置不匹配
- imagePullSecrets 配置错误

**解决方案**:
1. 检查 `values.yaml` 中的 `registry` 是否为 `192.168.0.114`
2. 检查 `imagePullSecrets` 是否为 `harbor-registry`
3. 确认 Kubernetes 中存在 `harbor-registry` Secret

**验证命令**:
```bash
# 检查 Secret 是否存在
kubectl get secret harbor-registry -n jiffoo-mall-core-dev

# 检查 Pod 事件
kubectl describe pod <pod-name> -n jiffoo-mall-core-dev
```

---

### **问题 2: 服务无法访问 / Connection Refused**

**症状**:
- 浏览器显示 "This site can't be reached"
- 连接被拒绝

**可能原因**:
1. **Pod 未运行**: ImagePullBackOff, CrashLoopBackOff
2. **端口号错误**: 使用了错误的 NodePort
3. **Service 未创建**: Helm 部署失败

**排查步骤**:
```bash
# 1. 检查 Pod 状态
kubectl get pods -n jiffoo-mall-core-dev

# 2. 检查 Service
kubectl get svc -n jiffoo-mall-core-dev

# 3. 检查 Pod 日志
kubectl logs <pod-name> -n jiffoo-mall-core-dev

# 4. 检查 Pod 详情
kubectl describe pod <pod-name> -n jiffoo-mall-core-dev
```

---

### **问题 3: 飞书通知未收到**

**原因**:
- `FEISHU_WEBHOOK_JIFFOO` Secret 未配置
- Webhook URL 错误

**解决方案**:
1. 在 GitHub Settings → Secrets 中添加 `FEISHU_WEBHOOK_JIFFOO`
2. 确认 Webhook URL 格式正确

---

## 🔍 故障排查

### **快速诊断命令**

```bash
# 1. 检查命名空间
kubectl get ns | grep jiffoo

# 2. 检查所有 Pod
kubectl get pods -n jiffoo-mall-core-dev -o wide

# 3. 检查失败的 Pod
kubectl get pods -n jiffoo-mall-core-dev --field-selector=status.phase!=Running

# 4. 查看 Pod 事件
kubectl get events -n jiffoo-mall-core-dev --sort-by='.lastTimestamp' | tail -20

# 5. 检查 Service
kubectl get svc -n jiffoo-mall-core-dev

# 6. 检查 Helm Release
helm list -n jiffoo-mall-core-dev

# 7. 查看 Helm Release 详情
helm get values jiffoo-mall-core -n jiffoo-mall-core-dev
```

### **查看 Pod 日志**

```bash
# 查看最新日志
kubectl logs <pod-name> -n jiffoo-mall-core-dev --tail=100

# 查看上一个容器的日志（如果 Pod 重启了）
kubectl logs <pod-name> -n jiffoo-mall-core-dev --previous

# 实时查看日志
kubectl logs -f <pod-name> -n jiffoo-mall-core-dev
```

---

## ✅ 部署检查清单

### **部署前检查**

- [ ] 确认 `values.yaml` 中 `registry: 192.168.0.114`
- [ ] 确认 `imagePullSecrets: harbor-registry`
- [ ] 确认 NodePort 端口映射正确（30001-30009）
- [ ] 确认 Ingress className 为 `traefik`（生产环境）
- [ ] 确认飞书通知 URL 正确
- [ ] 确认所有 GitHub Secrets 已配置

### **部署后验证**

- [ ] 检查 GitHub Actions 运行状态
- [ ] 检查所有 Pod 状态为 Running
- [ ] 测试所有服务 URL 可访问
- [ ] 确认飞书群收到部署通知
- [ ] 检查服务日志无错误

---

## 📚 相关文档

- [通知配置指南](./NOTIFICATION_SETUP.md)
- [Kubernetes 集群配置](./KUBERNETES_SETUP.md)
- [Harbor 仓库配置](./HARBOR_SETUP.md)

---

## 🔄 更新记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2025-11-06 | v1.0 | 初始版本，记录镜像仓库配置问题 |

---

**⚠️ 重要提醒**：
1. **镜像仓库配置必须一致**：CI/CD 和 Helm 必须使用相同的 registry
2. **端口号必须正确**：NodePort 映射规则必须与访问 URL 一致
3. **Ingress Controller 类型**：集群使用 Traefik，不是 nginx
4. **定期检查**：每次修改配置后，必须验证部署是否成功


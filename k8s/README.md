# Jiffoo Mall - Kubernetes Deployment Guide

## 🏗️ Architecture Overview

```
                            ┌─────────────────────────────────────────────────────────┐
                            │                   Ingress Controller                     │
                            │               (nginx-ingress / traefik)                  │
                            └─────────────────────────────────────────────────────────┘
                                      │              │              │
                                      ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Kubernetes Cluster (namespace: jiffoo)                  │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐                   │
│  │  shop-service   │   │   api-service   │   │  admin-service  │                   │
│  │  (Port: 3004)   │   │  (Port: 3001)   │   │  (Port: 3002)   │                   │
│  │   2 replicas    │   │   2 replicas    │   │   1 replica     │                   │
│  └────────┬────────┘   └────────┬────────┘   └────────┬────────┘                   │
│           │                     │                     │                             │
│           │                     ▼                     │                             │
│           │            ┌─────────────────┐            │                             │
│           │            │ postgres-service│            │                             │
│           │            │  (Port: 5432)   │            │                             │
│           │            └────────┬────────┘            │                             │
│           │                     │                     │                             │
│           │            ┌─────────────────┐            │                             │
│           └───────────▶│  redis-service  │◀───────────┘                             │
│                        │  (Port: 6379)   │                                          │
│                        └─────────────────┘                                          │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## 📊 Service & Port Assignment

| Service | Container Port | Service Port | Type | Domain (Subdomain Mode) |
|---------|----------------|--------------|------|-------------------------|
| **shop** | 3004 | 3004 | ClusterIP | shop.jiffoo.example.com |
| **api** | 3001 | 3001 | ClusterIP | api.jiffoo.example.com |
| **admin** | 3002 | 3002 | ClusterIP | admin.jiffoo.example.com |
| **postgres** | 5432 | 5432 | ClusterIP | (internal only) |
| **redis** | 6379 | 6379 | ClusterIP | (internal only) |

## 🚀 Quick Start

### 1. Create Namespace
```bash
kubectl apply -f namespace.yaml
```

### 2. Deploy Configuration & Secrets
```bash
# ⚠️ Edit secrets.yaml first to set your own passwords!
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
```

### 3. Deploy Infrastructure
```bash
kubectl apply -f postgres.yaml
kubectl apply -f redis.yaml

# Wait for databases to be ready
kubectl -n jiffoo wait --for=condition=ready pod -l app=postgres --timeout=120s
kubectl -n jiffoo wait --for=condition=ready pod -l app=redis --timeout=60s
```

### 4. Build & Push Docker Images
```bash
# From the Jiffoo project root
docker build -t your-registry/jiffoo-api:latest -f apps/api/Dockerfile .
docker build -t your-registry/jiffoo-shop:latest -f apps/shop/Dockerfile .
docker build -t your-registry/jiffoo-admin:latest -f apps/admin/Dockerfile .

docker push your-registry/jiffoo-api:latest
docker push your-registry/jiffoo-shop:latest
docker push your-registry/jiffoo-admin:latest
```

### 5. Deploy Applications
```bash
# Update image references in yaml files first!
kubectl apply -f api.yaml
kubectl apply -f shop.yaml
kubectl apply -f admin.yaml
```

### 6. Deploy Ingress
```bash
# Option A: Subdomain mode (recommended)
kubectl apply -f ingress.yaml

# Option B: Single domain / path mode
kubectl apply -f ingress-single-domain.yaml
```

## 🌐 Domain Configuration

### Option A: Subdomain Mode (Recommended)
```
shop.jiffoo.example.com  → Shop Frontend
api.jiffoo.example.com   → API Backend
admin.jiffoo.example.com → Admin Dashboard
```

### Option B: Path Mode
```
jiffoo.example.com/        → Shop Frontend
jiffoo.example.com/api/*   → API Backend
jiffoo.example.com/admin/* → Admin Dashboard
```

## 🔧 Customization

### Change Domain
1. Edit `configmap.yaml` - update PLATFORM_*_DOMAIN values
2. Edit `ingress.yaml` - update host values
3. Update TLS certificate secret names

### Change Resources
Edit the `resources` section in each deployment yaml:
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

### Enable HPA (Auto-scaling)
```bash
kubectl apply -f hpa.yaml  # Create HPA configuration
```

## 📁 File Structure

```
k8s/
├── namespace.yaml          # Namespace definition
├── configmap.yaml          # Non-sensitive configuration
├── secrets.yaml            # Sensitive data (passwords, keys)
├── postgres.yaml           # PostgreSQL StatefulSet + Service
├── redis.yaml              # Redis Deployment + Service
├── api.yaml                # API Backend Deployment + Service
├── shop.yaml               # Shop Frontend Deployment + Service
├── admin.yaml              # Admin Dashboard Deployment + Service
├── ingress.yaml            # Ingress (subdomain mode)
├── ingress-single-domain.yaml  # Ingress (path mode)
└── README.md               # This file
```

## ⚠️ Production Checklist

- [ ] Change all default passwords in `secrets.yaml`
- [ ] Set up external PostgreSQL (RDS, Cloud SQL, etc.) for production
- [ ] Set up external Redis (ElastiCache, Memorystore, etc.) for production
- [ ] Configure proper resource limits
- [ ] Set up cert-manager for HTTPS
- [ ] Configure backup strategy for database
- [ ] Set up monitoring (Prometheus, Grafana)
- [ ] Configure log aggregation (ELK, Loki)

---

**Made with ❤️ by the Jiffoo Team**

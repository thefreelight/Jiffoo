# Jiffoo - 开源电商平台

[English](README.md) | 简体中文

[![PR Quality Gates](https://github.com/thefreelight/Jiffoo/actions/workflows/pr-quality-gates.yml/badge.svg)](https://github.com/thefreelight/Jiffoo/actions/workflows/pr-quality-gates.yml)
[![License: GPL v2+](https://img.shields.io/badge/License-GPL%20v2+-blue.svg)](https://www.gnu.org/licenses/gpl-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-black.svg)](https://nextjs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5-green.svg)](https://www.fastify.io/)

> **一键把商店前端部署到 Cloudflare Pages：**
>
> [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/thefreelight/Jiffoo/tree/main/apps/shop)

Jiffoo 是一个 TypeScript 电商核心，面向自托管商店前端、后台管理工具，以及基于扩展的定制化能力。

**项目状态**：活跃开发中；每个进入 `main` 的 PR 都要通过四道 CI 质量门禁（类型检查、约 1,500 个基于 postgres/redis 的 API 测试、Prisma 漂移检查、主题矩阵 + API 面检查），外加 shop 与 admin 的端到端 Playwright 测试套件。

本仓库拥有的公开运行时面：

- `shop`（商店前端）
- `api`（API 服务）
- `admin`（后台管理）

在长期部署模型中，本仓库是公开/开源运行时面的源头，包括未来的 `jiffoo-prod` 生产命名空间。

## 功能特性

- 完整的电商流程：商品目录、购物车、结算、订单、支付
- **数字商品电商** —— 一等公民的虚拟商品支持：eSIM 二维码发货、兑换码、软件授权码、可下载商品，带自动化履约
- **智能体电商（MCP）** —— 官方 MCP server，让 AI 智能体能够以编程方式浏览商品、管理购物车、创建订单
- 主题包与插件式扩展机制
- Fastify API，Prisma 数据访问层
- Next.js 商店与后台应用
- 面向前端、主题、插件集成的共享 SDK
- 垂直行业模板：`create-jiffoo-app --template digital-goods` 或 `--template esim`，开箱即用

## 快速开始

### 环境要求

- Node.js 20+
- PostgreSQL 14+
- Redis 6+（缓存与异步任务）
- pnpm 9+

### 安装

```bash
git clone https://github.com/thefreelight/Jiffoo.git
cd Jiffoo
pnpm install
cp apps/api/.env.example .env
pnpm --filter api db:migrate
pnpm dev
```

### 一条命令脚手架 + 垂直行业模板

```bash
# 通用商店
npx create-jiffoo-app my-store

# 数字商品商店（礼品卡、兑换码、授权码、下载商品）
npx create-jiffoo-app my-store --template digital-goods

# eSIM 商城（流量套餐、二维码发货）
npx create-jiffoo-app my-esim-shop --template esim
```

虚拟商品履约细节，以及 Jiffoo 与 Medusa/Saleor 在数字商品优先场景下的差异，见[数字商品指南](docs/digital-commerce.md)。

### 一条命令服务器安装

在一台全新服务器上，最快的自托管路径：

```bash
curl -fsSL https://get.jiffoo.com | bash
```

如果服务器上已经有本仓库，也可以执行：

```bash
./install.sh
```

这条路径会按需安装 Docker，准备生产环境 `.env.production.local`，构建 `shop + api + admin`，启动 PostgreSQL 与 Redis，执行 Prisma 迁移，并可选地灌入演示数据：

- 后台：`admin@jiffoo.com / admin123`

重要默认值：

- 一条命令安装现在默认 `JIFFOO_DEMO_MODE=false`
- 未显式开启演示模式时，登录界面不显示演示账号
- 演示模式登录凭据由后端控制，不硬编码在前端

底层使用的生产 compose 文件：

```bash
docker compose --env-file .env.production.local -f docker-compose.prod.yml up -d --build
```

### 公开更新源拓扑

公开的自托管更新链路目前有两个独立的发布面：

1. `jiffoo-installer`
   - 新加坡集群拓扑使用的 Kubernetes 侧安装/静态辅助服务
2. `get.jiffoo.com`
   - OSS 更新检查所使用的权威公开自托管更新源与源码包下载源

`https://get.jiffoo.com/releases/core/manifest.json` 是自托管版本检测的唯一事实来源。只更新 Kubernetes `jiffoo-installer` 服务不会更新公开 OSS manifest 或源码包资产。

正式的 OSS 版本发布以新加坡集群发布链路为准。GitHub tag 或 GitHub Release 本身并不意味着自托管实例能检测到新版本；只有新加坡发布链路更新了 `get.jiffoo.com` 之后，版本检测才会变化。

RackNerd 品牌部署等下游环境属于消费实例：即使公开更新源已经推进，在显式滚动升级之前，它们仍可能报告旧版本或运行旧版 updater。

### 自托管升级模型

Docker Compose 升级器采用分阶段运行时切换模型：

- 默认路径为 `image-first`（镜像先行）
- `source-archive`（源码包）仅用于恢复
- `APP_VERSION` 只在活体运行时验证成功后才提交
- `api`、`shop`、`admin` 顺序切换，而不是一次性重建

完整决策链路与执行记录见专门的自托管升级文档。

### 维护者 OSS 补丁发布助手

维护者可以用以下命令准备或发布 OSS 补丁版本：

```bash
pnpm release:oss:patch -- --version 1.0.12 --notes "简短的发布摘要"
```

加 `--publish` 让助手完成：

- 仅暂存发布文件
- 创建发布提交与 tag
- 推送当前分支与 tag
- 创建 GitHub Release
- 上传 `core-update-manifest.json`、`jiffoo-source.tar.gz` 与 `jiffoo-source.tar.gz.sha256`

该助手面向维护者，不面向商户。它的职责是消除补丁发布中重复的流程性工作：

- 提升 OSS 版本元数据
- 对齐 `package.json`、公开 manifest 默认值与 build-target 元数据
- 生成自托管发布产物
- 创建 GitHub tag/release 并附上公开更新资产

如果想在实际改动 git 状态前检查将要执行的动作，先加 `--dry-run`。

重要提示：

- 对自托管更新检测而言，创建 GitHub Release 并不是最后的发布步骤。
- 最终发布检查点是 `https://get.jiffoo.com/releases/core/manifest.json`。
- 如果消费实例仍检测到旧版本，先核对公开 manifest，再确认消费主机确实完成了滚动升级。

### 本地地址

- 商店：`http://localhost:3003`
- 后台：`http://localhost:3002`
- API：`http://localhost:3001`

## 仓库结构

```text
Jiffoo/
├── apps/
│   ├── api/
│   ├── admin/
│   └── shop/
├── packages/
│   ├── core-api-sdk/
│   ├── create-jiffoo-app/
│   ├── mcp-server/
│   ├── plugin-sdk/
│   ├── shared/
│   ├── shop-themes/
│   ├── theme-api-sdk/
│   └── ui/
└── scripts/
```

## 文档

- [数字商品指南](docs/digital-commerce.md) — 虚拟商品履约、eSIM 发货、垂直行业模板
- [智能体电商指南](docs/agentic-commerce.md) — 面向 AI 智能体的 MCP server（Claude Desktop / Code 集成）
- [Create App CLI](packages/create-jiffoo-app/README.md)
- [Core API SDK](packages/core-api-sdk/README.md)
- [Plugin SDK](packages/plugin-sdk/README.md)
- [Theme API SDK](packages/theme-api-sdk/README.md)
- [自托管 Updater 规范](docs/operations/self-hosted-updater-spec.md)
- [自托管 Updater PRD](docs/operations/self-hosted-updater-prd.md)
- [自托管 Updater PRD 可执行版](docs/operations/self-hosted-updater-prd-executable.md)
- [ADR-0001 自托管 Updater 最后提交版本](docs/adr/ADR-0001-self-hosted-updater-version-commit-last.md)
- [跨平台主题客户端契约](docs/theme-client-platform-contract.md)
- [主题客户端 API 目录](docs/theme-client-api-catalog.json)
- [主题客户端兼容性矩阵](docs/theme-client-compatibility-matrix.md)
- [官方主题支持清单](docs/theme-client-official-theme-support.md)
- [第一波主题上线计划](docs/theme-client-first-wave-rollout.md)
- [默认主题包](packages/shop-themes/default/README.md)
- [发版流程](docs/RELEASE_PROCESS.md) — 发版班车节奏、Release notes 模板、分支卫生

## 许可证

Jiffoo 基于 [GNU General Public License v2.0 或更新版本](LICENSE)授权。

SDK 包（`@jiffoo/plugin-sdk`、`@jiffoo/theme-api-sdk`、`@jiffoo/core-api-sdk`、`@jiffoo/ui`、`create-jiffoo-app`）基于 MIT 授权，方便在不承担 copyleft 义务的前提下进行商业插件与主题开发。

完整的三层许可边界说明（GPL 核心 / MIT SDK / external-http 独立作品）见 [LICENSE-EXCEPTIONS.md](LICENSE-EXCEPTIONS.md)。

# Agent 插件业务需求与业务逻辑说明

> 本文档描述在 `API + admin + tenant + shop` 基座上，通过 `agent` 插件实现 to‑B 分销分润体系的最终业务逻辑，用作产品与后端的一致性参考。

---

## 1. 平台与角色概览

### 1.1 服务与应用

- `api`：后端服务，提供多租户电商核心能力与插件运行环境。
- `admin`：超级管理员后台，管理租户、插件、全局配置。
- `tenant`：租户后台，管理各自商城的商品、订单、代理、主题、插件等。
- `shop`：前台商城，面向终端消费者，支持多租户、多主题。
- `agent`：Agent Portal（代理后台），通过 `agent` 插件提供，面向 B 端渠道。
- `white-label`：白标控制台（可选），用于平台 OEM 品牌化。

### 1.2 业务角色

- **Super Admin（平台管理员）**
  - 管理租户、插件仓库、插件 License、平台级设置。

- **Tenant（租户）**
  - 品牌方/供应商。
  - 拥有自营商城（Tenant Mall）。
  - 能安装和配置插件（支付、认证、主题、Agent 等）。
  - 能创建和管理自己的 Agent 网络（L1/L2/L3）。

- **Agent（代理）**
  - B 端渠道商，分三级：L1 / L2 / L3。
  - 归属某个租户（`tenantId`），不跨租户。
  - 可以拥有自己的商城（Agent Mall），销售租户授权的商品变体。
  - 可以发展下级代理（在授权范围内）。

- **Shop User（终端消费者）**
  - 在 Tenant Mall 或 Agent Mall 浏览商品、下单、支付。

---

## 2. 域名、BYOK 与白标

### 2.1 域名模型

- 租户可配置多个域名：
  - 自营商城：`yolloo.com`；
  - 租户后台：`tenant.yolloo.com`；
  - Agent Portal：`agent.yolloo.com`（租户视角）；
  - API：`api.yolloo.com`（可选）。
- Agent 可绑定自己的商城域名：
  - 如 `agent-own-domain.com`，指向 Agent Mall。
- 域名统一通过：
  - `TenantDomain`：管理租户相关域名（`frontend` / `tenant-admin` / `agent-admin` / `api` / `frontend-agent`）；
  - `AgentDomain`：管理 Agent 自己的前台域名。

### 2.2 BYOK（Bring Your Own Key）

- 支持租户将自己的支付/邮件/认证配置接入：
  - 支付：Stripe（BYOK）、支付网关插件；
  - 邮件：Resend（BYOK）；
  - OAuth：Google（BYOK）。
- 当前阶段：
  - 所有订单的收款方为租户（包括 Agent Mall 订单）；
  - Agent 通过分润拿收益，不直接代收款。
- 后续可扩展：
  - Agent 自己的支付 BYOK，用于某些模式下的“代理直接收款”。

### 2.3 白标

- 租户具有平台白标能力：
  - 自定义 Logo、主色、平台名称、登录页视觉等。
- Agent Mall 可以配置自己的主题和店铺视觉：
  - 仅局限于 Agent Mall，不改变平台或租户级白标。
  - 例如：Banner、店铺名称、布局样式等。

---

## 3. 插件架构与 Agent 插件定位

### 3.1 插件统一入口

- 所有插件的 API 对前端统一暴露为：
  - `/api/plugins/<plugin-slug>/api/*`
- 统一由：
  - 插件网关（`plugin-gateway`）；
  - 商业化支持（`commercial-support`）；
  - 插件安装/License 管理（`plugin-installer` 等）
 进行安装与调用控制。

### 3.2 Agent 插件定位

- 插件 slug：`agent`。
- 类型：内部业务插件（TypeScript + Fastify）。
- 提供能力：
  - 三级代理管理（L1/L2/L3）；
  - Agent Mall 配置（主题、域名、Mall 默认设置）；
  - 商品变体维度授权（Self 路径 + Children 路径）；
  - 多级分润（订单 → 租户 + 多级 Agent），与支付插件（如 Stripe）联动；
  - Agent 侧 Portal API（自营 Mall + 下级授权 + 佣金视图）；
  - Super Admin 视角的 Agent 网络和插件 License 视图。

---

## 4. 商品与变体模型

### 4.1 商品（Product，SPU）

- 表示逻辑上的一个商品，如：
  - “日本 eSIM 套餐”；
  - “日本实体卡”；
  - “日本流量套餐”。
- 在 Shop 列表页按 SPU 展示。

### 4.2 变体（ProductVariant，SKU）

- 每个 Product 下有多个变体（SKU），如：
  - 日本 eSIM：1 天 / 3 天 / 7 天 / 30 天；
  - 日本流量套餐：1GB / 3GB / 10GB 等。
- 核心字段：
  - `productId`, `tenantId`；
  - `name`: 变体名称（如“1天套餐”）；
  - `attributes`: JSON（如 `{ "days": 1 }`）；
  - `basePrice`: 变体基础价；
  - `baseStock`: 变体基础库存；
  - `skuCode`（可选）；
  - `isActive`: 启用状态；
  - `agentCanDelegate`: 是否允许该变体进入代理体系（变体级按钮）。

---

## 5. 授权与定价：Self / Children 双路径

### 5.1 两条路径的本质

#### Self 路径（SelfConfig：`AgentVariantSelfConfig`）

- 面向“自己商城”的配置：
  - 当前 Owner（Tenant 或 Agent）的 Mall：
    - 能不能卖某个变体（`canSellSelf`）；
    - 卖多少（`selfPrice`，为空时继承上游价）。
- 角色：
  - Tenant：配置自营 Tenant Mall；
  - Agent：配置自己的 Agent Mall。

#### Children 路径（ChildrenConfig：`AgentVariantChildrenConfig`）

- 面向“下级代理”的配置：
  - 商品级按钮：`canDelegateProduct`，控制该商品能否进入本代理的“代理体系”；  
  - 变体级按钮：`canDelegateVariant`，控制具体变体能否分配给下级；
  - 价格约束：
    - `priceForChildren`：给下级的成本/起始价；
    - `priceForChildrenMin/Max`：下级允许设定的售价区间。

### 5.2 授权继承规则

#### 上游 → 下游链路

- 上游链：Tenant → L1 → L2 → L3。
- Owner 的“可操作变体池”由上游 Children 授权决定：
  - 若上游对某商品 `canDelegateProduct=false`，该商品从这条链路起不再可用；  
  - 若上游对某变体 `canDelegateVariant=false`，该变体从这条链路起不再可用；  
  - 下游不能重新打开上游禁掉的商品/变体。

#### Self 受 Children 约束

- 对 Tenant：
  - Tenant 是根，可以完全自由设置 Self（自营商城），Children 控制的是“给代理的池子”。
- 对 Agent：
  - Self 可售集合 = 上游通过 Children 下发的变体集合 ∩ 本地 Self 设置；  
  - 若上游没有给某变体授权（`canDelegate=false`），该 Agent 自己也不能卖此变体（即使 Self 想卖也不行）。

### 5.3 禁售与可售逻辑

- Children 路径禁售：
  - 商品级 `canDelegateProduct=false` 或 变体级 `canDelegateVariant=false`：
    - 本层及所有下游不可再卖此商品/变体，也不可继续授权；
- Self 路径禁售：
  - `canSellSelf=false`：
    - 本层自己的 Mall 不卖此变体；
    - 不影响 Children 授权，即不影响下级是否能卖（下级能否卖由 Children 是否授权决定）。

### 5.4 价格继承与限制

- 每个变体有一条价格链：Tenant → L1 → L2 → L3。
- Self 价格：
  - 默认：Owner 没设置 `selfPrice` 时，继承最近一层上游的有效价格；
  - 若设置 `selfPrice`：
    - 作为 Owner 自己 Mall 的终端售价；
    - 对 Agent 场景，必须满足 `selfPrice >= 上游 Children 的 effectiveMinPrice`。
- Children 价格：
  - 上游在 Children 配置中设定 `priceForChildrenMin/Max` 作为下级可设售价区间；
  - `priceForChildren` 可视为下级的默认成本价，供 UI 做提示。

---

## 6. Agent 层级结构与 Mall 类型

### 6.1 三级代理结构

- `Agent`：
  - `tenantId`: 所属租户；
  - `userId`: Agent 管理员用户；
  - `level`: 1/2/3；
  - `parentAgentId`: 上级 Agent；
  - 冗余统计：
    - `totalOrders`, `totalSales`, `totalCommission`, `availableBalance`, `pendingBalance` 等。
- 链路：
  - Tenant → L1 → L2 → L3；
  - 用于授权继承、Self/Children 合并、佣金计算。

### 6.2 Mall 类型

- Tenant Mall：
  - `ownerType='TENANT'`, `ownerId=tenantId.toString()`；
  - 通过 Tenant 的 SelfConfig 决定自营可售变体和价格。
- Agent Mall：
  - `ownerType='AGENT'`, `ownerId=agent.id`；
  - 通过 Agent 的 SelfConfig（与上游 Children 约束）决定可售变体和价格；
  - 支持独立域名、主题、配置。

---

## 7. 订单流与分润逻辑

### 7.1 订单来源

- 每个订单都带有 Mall 来源：
  - Tenant Mall 订单：只带 `tenantId`；
  - Agent Mall 订单：带 `tenantId + agentId`；
- Agent Mall 下单要求：
  - 每个订单项必须有 `variantId`；
  - 顶层必须带 `agentId`。

### 7.2 下单前授权校验与定价

- 使用 `AgentAuthorizationService.validateOrderAuthorization`：
  - 入参：
    - `tenantId`；
    - `ownerType = 'TENANT' | 'AGENT'`；
    - `ownerId`（Tenant 为 `tenantId.toString()`，Agent 为 `agent.id`）；
    - `items: [{ variantId, productId, quantity }]`；
  - 出参：
    - `authorizedItems: { variantId, productId, isAuthorized, effectivePrice }[]`；
    - `deniedItems: ...`；
    - `calculatedTotal`（所有授权项乘数量求和）。
- 业务规则：
  - 若存在 `deniedItems` ⇒ 订单创建失败，并返回拒绝原因；
  - 最终订单的行单价与总价以 `effectivePrice` 为准，不信任前端传入单价。

### 7.3 支付与分润

- 支付集成：
  - 使用支付插件（如 `stripe` 插件）创建支付 Session 并完成支付；
  - 支付成功 Webhook 中：
    - 调用 `affiliate` 插件计算 C 端推广佣金（如启用）；
    - 调用 `agent` 插件：
      - `calculateAgentCommission(orderId, tenantId, agentId)`：
        - 查出 Agent 链（L1/L2/L3）；
        - 按 `AgentLevelConfig` 中定义的总佣金率与各级分润比例，拆分订单 `totalAmount`；
        - 创建 `AgentCommission` 记录；
        - 更新 Agent 的余额与统计字段；
        - 将 `order.agentCommissionCalculated` 标记为 true。

---

## 8. 管理操作与前端视图

### 8.1 租户后台（Tenant）

- 商品详情页：
  - 展示商品基本信息 + 变体列表；
  - 提供 “变体授权设置面板”：  
    - Tab Self（自营商城）：
      - 配置 `canSellSelf` 和 `selfPrice`，决定租户自营商城卖哪些变体、卖多少；
    - Tab Children（给 Agent）：
      - 商品级按钮：`canDelegateProduct`；
      - 变体级按钮：`canDelegateVariant`；
      - 给 Agent 的成本价与上下限：`priceForChildren`, `priceForChildrenMin/Max`。

- 代理管理页：
  - 创建/编辑/审核代理（L1/L2/L3）；
  - 查看代理链及每级统计信息；
  - 配置 Agent 等级的佣金比例和分润比例（`AgentLevelConfig`）；
  - 查看代理佣金列表与提现请求。

### 8.2 Agent Portal

- “我的商城”：
  - 查看自己 Mall 下可售商品及变体；
  - 配置自己的 SelfConfig：`canSellSelf`, `selfPrice`；
  - 受上游 Children 限制：只能在被授权的变体池中操作，价格不得低于上游下发的最低价。

- “下级授权”：
  - 查看上游下发给自己的授权池（通过 ChildrenConfig 计算出的可操作集）；
  - 对商品/变体设置：
    - 是否继续下发给下级代理；
    - 给下级代理的成本/价格区间。

- “收益中心”：
  - 查看自己的 AgentCommission 记录；
  - 查看统计：总销售额、总佣金、待结算、可提现；
  - 发起提现请求（由租户或平台处理实际出款）。

### 8.3 Super Admin（Admin）

- Agent 插件 License 管理：
  - 为指定租户激活/停用 `agent` 插件；
- 全平台代理视图：
  - 总代理数、活跃代理数；
  - 有代理功能的租户数；
  - 总 Agent 分润金额等统计。

---

## 9. 非功能性要求与演进方向（简要）

- 插件化与解耦：
  - Agent 逻辑只通过 `agent` 插件导出装饰器与 API；
  - 核心 `product`/`order` 模块通过 `AgentAuthorizationService` 获取授权与价格。

- 扩展性：
  - 三级代理的数据结构保留拓展空间，可将来扩展为更深层，前端产品默认只开放 2–3 级；
  - 分润规则可扩展为固定金额、阶梯、混合模式等。

- 安全与审计：
  - 对关键操作（授权变更、价格变更、等级调整等）记录审计日志；
  - 对插件 License 和分润计算进行必要的监控与告警。

---

# 单服务多商城（Tenant = Mall）主题插件架构指南（最终指导版）

本指南给出“单服务多租户（一个租户即一个商城）+ 主题插件包”的前端架构蓝图，目标是让租户在插件市场安装并启用主题后，前端商城整站 UI 立即切换，同时保持后端业务逻辑完全一致。设计强调可行性、简洁性与可维护性，避免过度工程化。

---

## 目标与原则

- 一租户一商城：租户与商城一一对应；切换租户即切换商城。
- 主题即插件：主题以独立包交付（workspace 包或私有 registry 包）。
- 简洁可行：以最小分层实现“整站替换”，可渐进增强，不预设复杂配套。
- 运行时决定主题：根据 Mall Context 返回的 `theme.slug` 决定加载哪个主题包。
- 默认主题：`default` 为平台内置主题，任何租户可启用。

---

## 后端 Tenant.theme JSON 结构规范

为了确保前后端对主题数据的理解一致，后端在 `Tenant.theme` 字段中存储的 JSON 应遵循以下结构：

```json
{
  "slug": "default",
  "config": {
    "brand": {
      "logoUrl": "https://cdn.example.com/logo.png",
      "primaryColor": "#2563eb"
    },
    "features": {
      "showWishlist": true
    }
  },
  "version": "1.0.0",
  "pluginSlug": "shop-theme-default"
}
```

字段说明：
- `slug`（必需）：主题包在前端 `THEME_REGISTRY` 中的 key（如 `"default"`）。前端通过此字段动态加载对应主题包。
- `config`（可选）：租户级主题配置，结构遵循 `ThemeConfig` 接口。包含品牌化、功能开关等租户特定的视觉与行为配置。
- `version`（可选）：主题版本，与前端主题包版本保持一致（如 `"1.0.0"`）。用于版本管理与兼容性检查。
- `pluginSlug`（可选）：对应的后端插件 `Plugin.slug`（如 `"shop-theme-default"`）。用于后端追踪当前启用的主题插件。

前端使用方式：
- `MallContextService.getContext()` 返回的 `theme` 字段已通过 `JSON.parse(tenant.theme)` 解析，前端可直接按上述结构访问。
- 前端根据 `theme.slug` 从 `THEME_REGISTRY` 加载主题包。
- 前端将 `theme.config` 与主题包的 `defaultConfig` 深度合并，作为最终配置透传给主题组件。

---

## 分层与职责（最小 3 层）

- 平台层（Platform）
  - Mall Context：识别租户并返回 `{ tenantId, tenantName, theme: { slug, config? } }`。
  - ApiClient：统一拦截器，自动附带 `X-Tenant-ID` 请求头。
  - Tenant 管理：存储/监听当前租户信息，供前端使用。

- 页面编排层（Pages）
  - App Router 页面：处理路由与回调、发起数据请求、从 ThemeProvider 取组件并渲染。
  - 可选聚合 Hook（Presenter，可选）：将多个数据源整合为页面级 Props（非必须，按需使用）。

- 主题层（Themes）
  - 主题包组件：纯展示，不做数据请求、不读全局状态；接收页面层传入 Props 与回调。
  - 主题 tokens（可选）：CSS 变量，作为视觉风格入口。

---

## 模块与目录

- 前端应用（apps/frontend）
  - `lib/mall-context.ts`：Mall Context 客户端封装（检测租户、拉取上下文）。
  - `lib/themes/registry.ts`：主题注册表（slug → 动态导入函数）。
  - `lib/themes/provider.tsx`：ThemeProvider（决定主题 slug、懒加载主题包、缓存、暴露 `useShopTheme()`）。
  - `app/*/page.tsx`：页面，从 Provider 取主题组件并渲染；可按需调用聚合 Hook。
  - `styles/*`：通用样式；主题 tokens 由主题包提供（可选）。

- 主题包（packages/shop-themes/<slug>）
  - `src/index.ts`：导出 `ThemePackage`。
  - `src/components/*.tsx`：页面/区块展示组件（HomePage、ProductsPage…）。
  - `src/tokens.css`（可选）：CSS 变量（颜色、圆角、间距等）。

- 后端（apps/backend）
  - Mall Context API：`GET /api/mall/context?tenant=<id>|domain=<host>`。
  - Admin/插件市场：主题安装清单、为租户启用主题（保存主题配置，见下）。

- 共享（packages/shared）
  - 主题类型契约、ApiClient、Tenant 管理等基础设施。

---

## 主题包契约（ThemePackage）

```ts
export interface ThemePackage {
  // 页面与常用区块组件，一次性整包加载
  components: Record<string, React.ComponentType<any>>;

  // 可选：主题 tokens（CSS 变量），用于快速切换品牌风格
  tokensCSS?: string | (() => Promise<string>);

  // 可选：默认配置（可被租户级配置覆盖）
  defaultConfig?: Record<string, any>;
}
```

- 必备组件建议：`HomePage`、`ProductsPage`、`ProductDetailPage`、`CartPage`、`CheckoutPage`、`NotFound`。
- 包名建议：`@shop-themes/<slug>`；默认主题为 `@shop-themes/default`。
- 构建约定：允许通过 sideEffects 引入 CSS，例如 `"sideEffects": ["./src/tokens.css"]`。

---

## 主题配置（按租户维度）

动机：为不同租户在同一主题下提供品牌化与轻量差异化能力（无需复制主题包）。

- 后端为每个租户保存：
  ```json
  {
    "theme": {
      "slug": "default",
      "config": {
        "brand": {
          "logoUrl": "https://cdn.example.com/logo.png",
          "primaryColor": "#2563eb"
        },
        "features": {
          "showWishlist": true,
          "enableHeroVideo": false
        }
      },
      "version": "1.0.0"
    }
  }
  ```
- Mall Context API 返回 `{ slug, config, version }`；前端合并 `config` 与主题包的 `defaultConfig`：
  ```ts
  const merged = deepMerge(themePkg.defaultConfig ?? {}, mallContext.theme?.config ?? {})
  ```
- 使用方式：
  - 将 `merged` 作为 `config` 透传给主题组件；
  - 或将其中的视觉部分映射为 CSS 变量（tokens）注入 `<style>`。
- 约束：config 仅限视觉/开关型字段，不得包含可执行脚本。

推荐最小 schema（类型示例）：
```ts
export interface ThemeConfig {
  brand?: {
    logoUrl?: string
    primaryColor?: string
    secondaryColor?: string
  }
  layout?: {
    headerSticky?: boolean
    showFooterLinks?: boolean
  }
  features?: {
    showWishlist?: boolean
    showRatings?: boolean
  }
}
```

---

## 主题包文件结构（标准样式）

```
packages/
  shop-themes/
    default/
      package.json
      tsconfig.json
      src/
        index.ts              # 导出 ThemePackage
        tokens.css            # 可选：CSS 变量（sideEffects 引入）
        components/
          HomePage.tsx
          ProductsPage.tsx
          ProductDetailPage.tsx
          CartPage.tsx
          CheckoutPage.tsx
          NotFound.tsx
          ui/                 # 可选：主题内部 UI 片段
            Button.tsx
            Card.tsx
```

package.json（示例）：
```json
{
  "name": "@shop-themes/default",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "sideEffects": ["./src/tokens.css"],
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  }
}
```

src/index.ts（示例）：
```ts
import './tokens.css' // 可选：若希望构建后自动注入 tokens

import { HomePage } from './components/HomePage'
import { ProductsPage } from './components/ProductsPage'
import { ProductDetailPage } from './components/ProductDetailPage'
import { CartPage } from './components/CartPage'
import { CheckoutPage } from './components/CheckoutPage'
import { NotFound } from './components/NotFound'

export const theme: ThemePackage = {
  components: {
    HomePage,
    ProductsPage,
    ProductDetailPage,
    CartPage,
    CheckoutPage,
    NotFound,
  },
  defaultConfig: {
    brand: { primaryColor: '#2563eb' },
    features: { showWishlist: true }
  }
}

export default theme
```

组件约束：
- 纯展示组件：不发请求、不读全局 state，不做路由跳转；只接收 Props 与回调。
- Props 由页面编排层（或 Presenter）聚合；主题组件不依赖平台内部 UI 包，但可使用自己包内的 `ui/*`。

---

## 主题注册与 Provider（代码样例）

注册表（apps/frontend/lib/themes/registry.ts）：
```ts
export const THEME_REGISTRY = {
  default: () => import('@shop-themes/default')
  // 未来：brandA: () => import('@shop-themes/brand-a')
} as const
export type ThemeSlug = keyof typeof THEME_REGISTRY
```

Provider（apps/frontend/lib/themes/provider.tsx，要点示例）：
```tsx
'use client'
import React, { createContext, useContext, useMemo, useRef, useEffect, useState } from 'react'
import type { ThemePackage } from 'shared/src/types/theme'
import { THEME_REGISTRY, type ThemeSlug } from './registry'

type ThemeState = { slug: ThemeSlug; pkg: ThemePackage | null; config?: Record<string, any> }
const ThemeCtx = createContext<ThemeState | null>(null)

export function ThemeProvider({ slug, config, children }: { slug: ThemeSlug; config?: Record<string, any>; children: React.ReactNode }) {
  const cache = useRef(new Map<ThemeSlug, ThemePackage>())
  const [pkg, setPkg] = useState<ThemePackage | null>(cache.current.get(slug) ?? null)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (cache.current.has(slug)) {
        setPkg(cache.current.get(slug)!)
        return
      }
      const mod = await THEME_REGISTRY[slug]()
      const themePkg: ThemePackage = (mod.default || mod.theme) as ThemePackage
      cache.current.set(slug, themePkg)
      if (mounted) setPkg(themePkg)
    }
    load()
    return () => { mounted = false }
  }, [slug])

  // 可选：将 config 或 defaultConfig 映射为 CSS 变量
  useEffect(() => {
    if (!pkg) return
    const merged = { ...(pkg.defaultConfig ?? {}), ...(config ?? {}) }
    if (merged?.brand?.primaryColor) {
      document.documentElement.style.setProperty('--primary-color', merged.brand.primaryColor)
    }
  }, [pkg, config])

  const value = useMemo(() => ({ slug, pkg, config }), [slug, pkg, config])
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
}

export function useShopTheme() {
  const ctx = useContext(ThemeCtx)
  if (!ctx || !ctx.pkg) return { theme: null as any }
  return { theme: ctx.pkg, config: ctx.config }
}
```

---

## 页面编排层：标准代码样式

命名与路由到组件的映射（建议）：
- `/` → `HomePage`
- `/products` → `ProductsPage`
- `/products/[id]` → `ProductDetailPage`
- `/cart` → `CartPage`
- `/checkout` → `CheckoutPage`
- 兜底 → `NotFound`

标准页面模板（apps/frontend/app/products/page.tsx 示例）：
```tsx
'use client'
import { useShopTheme } from '@/lib/themes'
import { useTenantNavigation } from '@/hooks/use-tenant-navigation'
import { useAuthStore } from '@/store/auth'
import { useCartStore } from '@/store/cart'
// 可选：聚合 Hook，将多源数据整形成页面 Props
import { useProductsPageProps } from '@/lib/presenters/useProductsPageProps'

export default function ProductsPage() {
  const { theme, config } = useShopTheme()
  const nav = useTenantNavigation()
  const { isAuthenticated } = useAuthStore()
  const addItem = useCartStore(s => s.addItem)
  const pageProps = useProductsPageProps() // 若简单页面，可直接在此组装 props

  const ThemeProductsPage = theme?.components?.ProductsPage as any
  const ThemeNotFound = theme?.components?.NotFound as any

  const handleAddToCart = async (productId: number) => {
    if (!isAuthenticated) return nav.push('/auth/login')
    await addItem(String(productId), 1)
  }

  if (!ThemeProductsPage) {
    return ThemeNotFound ? <ThemeNotFound route="/products" onGoHome={() => nav.push('/')} /> : null
  }

  return (
    <ThemeProductsPage
      {...pageProps}
      config={config}
      onAddToCart={handleAddToCart}
    />
  )
}
```

注意事项：
- 页面用作编排层：只处理路由、回调与服务交互；不直接渲染平台内部 UI 细节。
- 回调进入服务层/Store 完成副作用；主题组件只展示并触发回调。
- NotFound 兜底可来自主题包；若缺失则使用平台兜底页。

---

## 运行流程（请求到渲染，整包一次加载）

1) 前端启动后获取 Mall Context，拿到 `theme.slug`（如 `default`）。
2) ThemeProvider 依据 slug 从注册表懒加载主题包（整包一次性加载）。
3) 可选：注入主题 tokens（CSS 变量）或将 `theme.config` 映射为 CSS 变量。
4) 页面从 `useShopTheme()` 获取主题组件字典，渲染对应页面组件，并通过回调与平台服务交互。

错误与回退：
- 找不到主题 slug → 回退加载 `default`。
- 主题包缺少某页面组件 → 使用主题包内的 `NotFound` 组件兜底。
- 动态导入失败 → 统一报错组件（来自 `default`）。

---

## 性能与打包

- 整包一次加载：每次仅加载当前主题包代码分块，简化实现并保证稳定性。
- 缓存：内存缓存已加载的 ThemePackage，避免重复动态导入；tokens 仅首次注入。
- 可选后续：当页面体量上来后，再考虑组件级拆分（非首要目标）。

---

## 开发与运行

- 工作区：`packages/shop-themes/*` 放置主题包；前端 `next.config.js` 将主题包加入 `transpilePackages`。
- Tailwind：主题 tokens 通过 CSS 变量承载；确保扫描路径包含 `./app/**/*`, `./components/**/*`, `./hooks/**/*`, `./lib/**/*`, `./store/**/*`。
- Mall Context：`GET /api/mall/context` 返回 `{ tenantId, tenantName, theme }`；前端 ApiClient 透传 `X-Tenant-ID`。

---

## Presenter 层（可选）详解

定义：
- 一个“页面级聚合 Hook”（如 `useProductsPageProps()`），从多个数据源（services/store）聚合数据并整形成“主题页面组件所需 Props”。不做路由与副作用，纯数据整形。

优势：
- 稳定契约：把“业务数据形状”和“主题组件 Props”隔离，主题更换时页面编排层不易受影响。
- 复用与测试：可为多个页面/变体复用，易于单元测试（无副作用）。
- 降低重复：当页面需要多源数据（例如列表 + 价格区间 + 登录状态）时减少拼装重复。

劣势：
- 额外抽象：简单页面会多一个文件与心智负担。
- 过度使用会让目录层次变深、定位困难。

使用建议：
- 当页面需要 2 个及以上数据源并存在非 trivial 整形/合并/排序时采用；
- 当相同页面 Props 在多个入口被复用时采用；
- 简单页面（单一数据源/逻辑简单）不使用 Presenter，直接在页面里拼装好传给主题组件。

示例（简化）：
```ts
// apps/frontend/lib/presenters/useProductsPageProps.ts
export function useProductsPageProps() {
  const { data: products, isLoading } = useProductsQuery()
  const { data: filters } = usePriceRangeQuery()
  return { products: products ?? [], filters, isLoading }
}
```

页面使用：
```tsx
// apps/frontend/app/products/page.tsx
const { theme } = useShopTheme()
const pageProps = useProductsPageProps()
const ThemeProductsPage = theme.components.ProductsPage
return <ThemeProductsPage {...pageProps} onAddToCart={handleAddToCart} />
```

---

## 安全与合规

- 主题包仅允许渲染 UI，不得直接发请求或操作平台全局状态；所有数据/副作用由页面编排层负责。
- 私有 registry/工作区白名单：仅允许经过审核的主题包被注册与加载。
- 配置白名单：`theme.config` 仅允许有限字段，杜绝注入风险；由主题包定义类型并在后端校验。


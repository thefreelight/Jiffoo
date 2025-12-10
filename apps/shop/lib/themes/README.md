# Jiffoo Theme System API

主题系统 API 文档 - ThemeProvider 和 useShopTheme 使用指南。

## 概述

主题系统提供了动态加载和切换主题的能力，支持：
- 动态主题加载（按需导入）
- 主题缓存（避免重复加载）
- 配置合并（租户配置覆盖默认配置）
- CSS 变量注入（品牌色、字体等）
- 错误回退（加载失败时回退到默认主题）

## API 参考

### ThemeProvider

主题提供者组件，负责加载和提供主题包。

```tsx
import { ThemeProvider } from '@/lib/themes/provider';

<ThemeProvider slug="default" config={tenantConfig}>
  <App />
</ThemeProvider>
```

#### Props

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `slug` | `string` | ✅ | 主题标识符 |
| `config` | `ThemeConfig` | ❌ | 租户特定配置 |
| `children` | `ReactNode` | ✅ | 子组件 |

#### 行为

1. **加载状态**: 显示 skeleton 加载动画
2. **错误处理**: 显示错误信息和重新加载按钮
3. **缓存**: 已加载的主题会被缓存，避免重复加载
4. **回退**: 无效的 slug 会回退到 `default` 主题

---

### useShopTheme

获取当前主题的 React Hook。

```tsx
import { useShopTheme } from '@/lib/themes/provider';

function MyComponent() {
  const { theme, config, isLoading, error } = useShopTheme();
  
  if (isLoading) return <Loading />;
  if (error) return <Error message={error.message} />;
  
  const { HomePage, ProductsPage } = theme.components;
  return <HomePage {...props} />;
}
```

#### 返回值

| 属性 | 类型 | 说明 |
|------|------|------|
| `theme` | `ThemePackage \| null` | 当前主题包 |
| `config` | `ThemeConfig` | 合并后的配置 |
| `isLoading` | `boolean` | 是否正在加载 |
| `error` | `Error \| null` | 加载错误 |

#### 注意事项

- 必须在 `ThemeProvider` 内部使用
- 在 Provider 外使用会抛出错误

---

### THEME_REGISTRY

主题注册表，映射 slug 到动态导入函数。

```typescript
// lib/themes/registry.ts
export const THEME_REGISTRY = {
  default: () => import('@shop-themes/default'),
  // premium: () => import('@shop-themes/premium'),
} as const;

export type ThemeSlug = keyof typeof THEME_REGISTRY;
```

#### 辅助函数

```typescript
// 验证 slug 是否有效
isValidThemeSlug(slug: string): slug is ThemeSlug

// 获取主题导入函数
getThemeImporter(slug: ThemeSlug): () => Promise<ThemeModule>

// 获取所有可用主题
getAvailableThemes(): ThemeSlug[]
```

---

## 使用示例

### 基础用法

```tsx
// app/layout.tsx
import { ThemeProvider } from '@/lib/themes/provider';

export default function RootLayout({ children }) {
  return (
    <ThemeProvider slug="default">
      {children}
    </ThemeProvider>
  );
}
```

### 带租户配置

```tsx
// app/[tenant]/layout.tsx
import { ThemeProvider } from '@/lib/themes/provider';

export default function TenantLayout({ children, params }) {
  const tenantConfig = await getTenantConfig(params.tenant);
  
  return (
    <ThemeProvider 
      slug={tenantConfig.themeSlug} 
      config={tenantConfig.themeConfig}
    >
      {children}
    </ThemeProvider>
  );
}
```

### 在页面中使用主题组件

```tsx
// app/page.tsx
'use client';

import { useShopTheme } from '@/lib/themes/provider';

export default function HomePage() {
  const { theme, config, isLoading } = useShopTheme();
  
  if (isLoading || !theme) {
    return <div>Loading...</div>;
  }
  
  const { HomePage: ThemedHomePage } = theme.components;
  
  return (
    <ThemedHomePage
      featuredProducts={products}
      categories={categories}
      onProductClick={(id) => router.push(`/products/${id}`)}
      onAddToCart={(id) => addToCart(id)}
    />
  );
}
```

---

## CSS 变量

ThemeProvider 会自动注入以下 CSS 变量：

| 变量 | 来源 | 说明 |
|------|------|------|
| `--theme-primary` | `config.brand.primaryColor` | 主色调 |
| `--theme-secondary` | `config.brand.secondaryColor` | 次色调 |
| `--theme-font` | `config.brand.fontFamily` | 字体 |

在 CSS/Tailwind 中使用：

```css
.button {
  background-color: var(--theme-primary);
}
```

---

## 添加新主题

1. 在 `packages/shop-themes/` 创建新主题包
2. 在 `registry.ts` 注册主题：

```typescript
export const THEME_REGISTRY = {
  default: () => import('@shop-themes/default'),
  premium: () => import('@shop-themes/premium'), // 新增
} as const;
```

3. 使用新主题：

```tsx
<ThemeProvider slug="premium">
  <App />
</ThemeProvider>
```

---

## 相关文档

- 主题开发指南: `packages/shop-themes/README.md`
- 类型定义: `packages/shared/src/types/theme.ts`


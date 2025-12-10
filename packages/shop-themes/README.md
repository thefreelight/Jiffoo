# Jiffoo Shop Themes

主题包开发指南 - 为 Jiffoo 商城创建自定义主题。

## 概述

Jiffoo 主题系统允许开发者创建完全自定义的商城前端主题。每个主题是一个独立的 npm 包，实现 `ThemePackage` 接口。

## 快速开始

### 1. 创建主题包

```bash
mkdir packages/shop-themes/my-theme
cd packages/shop-themes/my-theme
pnpm init
```

### 2. 配置 package.json

```json
{
  "name": "@shop-themes/my-theme",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "react": "^18.0.0",
    "shared": "workspace:*"
  }
}
```

### 3. 创建主题入口

```typescript
// src/index.ts
import type { ThemePackage } from 'shared';
import { HomePage } from './components/HomePage';
import { ProductsPage } from './components/ProductsPage';
// ... 导入其他组件

const theme: ThemePackage = {
  components: {
    HomePage,
    ProductsPage,
    ProductDetailPage,
    CartPage,
    CheckoutPage,
    NotFound,
    // ... 其他必需组件
  },
  tokensCSS: () => import('./tokens.css?raw').then(m => m.default),
  defaultConfig: {
    brand: { name: 'My Theme' },
    colors: { primary: '#3B82F6' }
  }
};

export default theme;
```

## 必需组件

每个主题必须实现以下组件：

| 组件 | Props 接口 | 说明 |
|------|-----------|------|
| `HomePage` | `HomePageProps` | 首页 |
| `ProductsPage` | `ProductsPageProps` | 商品列表页 |
| `ProductDetailPage` | `ProductDetailPageProps` | 商品详情页 |
| `CartPage` | `CartPageProps` | 购物车页 |
| `CheckoutPage` | `CheckoutPageProps` | 结账页 |
| `NotFound` | `NotFoundProps` | 404 页面 |
| `Header` | `HeaderProps` | 页头组件 |
| `Footer` | `FooterProps` | 页脚组件 |

完整组件列表见 `shared/src/types/theme.ts`。

## 组件 Props 示例

### HomePageProps

```typescript
interface HomePageProps extends ThemeI18nProps {
  featuredProducts: Product[];
  categories: ProductCategory[];
  onProductClick: (productId: string) => void;
  onCategoryClick: (categoryId: string) => void;
  onAddToCart: (productId: string) => void;
}
```

### ProductsPageProps

```typescript
interface ProductsPageProps extends ThemeI18nProps {
  products: Product[];
  categories: ProductCategory[];
  currentCategory?: ProductCategory;
  pagination: { page: number; totalPages: number; total: number };
  sortBy: string;
  onSortChange: (sort: string) => void;
  onPageChange: (page: number) => void;
  onProductClick: (productId: string) => void;
  onAddToCart: (productId: string) => void;
}
```

## CSS 变量 (Design Tokens)

主题可以通过 CSS 变量定义设计令牌：

```css
/* src/tokens.css */
:root {
  --theme-primary: #3B82F6;
  --theme-secondary: #10B981;
  --theme-background: #FFFFFF;
  --theme-text: #1F2937;
  --theme-font: 'Inter', sans-serif;
  --theme-radius: 8px;
}
```

## 主题配置

租户可以通过 `ThemeConfig` 自定义主题：

```typescript
interface ThemeConfig {
  brand?: { logoUrl?: string; name?: string };
  colors?: { primary?: string; secondary?: string };
  layout?: { headerStyle?: 'fixed' | 'static' };
  features?: { showReviews?: boolean };
}
```

## 国际化支持

所有组件都接收 `locale` 和 `t` props：

```typescript
const HomePage: React.FC<HomePageProps> = ({ t, locale }) => {
  return <h1>{t?.('home.welcome') || 'Welcome'}</h1>;
};
```

## 目录结构

```
packages/shop-themes/my-theme/
├── src/
│   ├── index.ts          # 主题入口
│   ├── tokens.css        # CSS 变量
│   ├── components/       # 页面组件
│   │   ├── HomePage.tsx
│   │   ├── ProductsPage.tsx
│   │   └── ...
│   └── ui/               # UI 组件
│       ├── Button.tsx
│       └── Card.tsx
├── package.json
└── tsconfig.json
```

## 参考

- 默认主题: `packages/shop-themes/default/`
- 类型定义: `packages/shared/src/types/theme.ts`
- 主题系统 API: `apps/frontend/lib/themes/README.md`


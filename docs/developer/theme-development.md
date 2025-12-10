# 主题开发指南

## 概述

Jiffoo Mall 主题系统基于 Next.js 和 Tailwind CSS，支持：
- 设计 Token 定制
- 组件变体
- 响应式布局
- 暗色模式

## 快速开始

### 1. 安装 SDK

```bash
npm install @jiffoo/theme-sdk
```

### 2. 创建主题清单

```json
// theme.json
{
  "slug": "modern-fashion",
  "name": "Modern Fashion",
  "version": "1.0.0",
  "description": "A modern theme for fashion stores",
  "author": "Your Name",
  "category": "fashion",
  "thumbnail": "/themes/modern-fashion/thumbnail.png",
  "screenshots": [
    "/themes/modern-fashion/screenshot-1.png",
    "/themes/modern-fashion/screenshot-2.png"
  ],
  "features": [
    "Responsive design",
    "Dark mode support",
    "Product quick view"
  ],
  "tokens": {
    "colors": {
      "primary": "#000000",
      "primaryForeground": "#ffffff",
      "background": "#ffffff",
      "foreground": "#111827"
    }
  }
}
```

### 3. 验证主题

```typescript
import { validateThemeManifest } from '@jiffoo/theme-sdk';

const result = validateThemeManifest(manifest);
if (!result.valid) {
  console.error('Errors:', result.errors);
}
if (result.warnings.length > 0) {
  console.warn('Warnings:', result.warnings);
}
```

## 主题清单 (Manifest)

### 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `slug` | string | 唯一标识符 |
| `name` | string | 显示名称 |
| `version` | string | 版本号 (semver) |
| `description` | string | 描述 |
| `author` | string | 作者 |
| `category` | string | 分类 |
| `thumbnail` | string | 缩略图 URL |

### 可选字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `screenshots` | string[] | 截图 URL 列表 |
| `features` | string[] | 功能特性 |
| `tags` | string[] | 标签 |
| `tokens` | object | 设计 Token |
| `components` | object | 组件配置 |

### 分类 (Category)

- `general` - 通用
- `fashion` - 时尚服饰
- `electronics` - 数码电子
- `food` - 餐饮美食
- `home` - 家居生活
- `beauty` - 美妆护肤
- `sports` - 运动户外
- `minimal` - 极简风格
- `luxury` - 奢侈品

## 设计 Token

### 颜色 Token

```json
{
  "colors": {
    "primary": "#3B82F6",
    "primaryForeground": "#ffffff",
    "secondary": "#10B981",
    "secondaryForeground": "#ffffff",
    "background": "#ffffff",
    "foreground": "#111827",
    "muted": "#F3F4F6",
    "mutedForeground": "#6B7280",
    "border": "#E5E7EB",
    "destructive": "#EF4444",
    "success": "#22C55E",
    "warning": "#F59E0B"
  }
}
```

### 排版 Token

```json
{
  "typography": {
    "fontFamily": {
      "sans": "Inter, sans-serif",
      "serif": "Georgia, serif"
    },
    "fontSize": {
      "xs": "0.75rem",
      "sm": "0.875rem",
      "base": "1rem",
      "lg": "1.125rem",
      "xl": "1.25rem"
    }
  }
}
```

### 间距 Token

```json
{
  "spacing": {
    "xs": "0.25rem",
    "sm": "0.5rem",
    "md": "1rem",
    "lg": "1.5rem",
    "xl": "2rem"
  }
}
```

### 圆角 Token

```json
{
  "borderRadius": {
    "none": "0",
    "sm": "0.125rem",
    "md": "0.375rem",
    "lg": "0.5rem",
    "full": "9999px"
  }
}
```

## 生成 CSS 变量

```typescript
import { generateCSSVariables } from '@jiffoo/theme-sdk';

const tokens = {
  colors: {
    primary: '#3B82F6',
    background: '#ffffff'
  },
  spacing: {
    md: '1rem'
  }
};

const css = generateCSSVariables(tokens);
// 输出:
// :root {
//   --color-primary: #3B82F6;
//   --color-background: #ffffff;
//   --spacing-md: 1rem;
// }
```

## 组件配置

### Header 组件

```json
{
  "components": {
    "header": {
      "variant": "sticky",
      "props": {
        "transparent": true,
        "showSearch": true
      }
    }
  }
}
```

### ProductCard 组件

```json
{
  "components": {
    "productCard": {
      "variant": "minimal",
      "props": {
        "showQuickView": true,
        "showWishlist": true
      }
    }
  }
}
```

## 主题目录结构

```
themes/
└── modern-fashion/
    ├── theme.json          # 主题清单
    ├── thumbnail.png       # 缩略图
    ├── screenshots/        # 截图
    ├── components/         # 自定义组件
    │   ├── Header.tsx
    │   ├── Footer.tsx
    │   └── ProductCard.tsx
    ├── styles/             # 样式文件
    │   └── globals.css
    └── README.md           # 说明文档
```

## 发布主题

1. 验证清单：`validateThemeManifest(manifest)`
2. 准备截图和缩略图
3. 在主题商城提交审核
4. 审核通过后上架

## 最佳实践

1. **响应式设计** - 确保在所有设备上正常显示
2. **无障碍** - 遵循 WCAG 标准
3. **性能** - 优化图片和代码
4. **暗色模式** - 提供暗色主题支持
5. **国际化** - 支持多语言


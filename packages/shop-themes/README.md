# Jiffoo Shop Themes

This package namespace contains storefront themes used by the open-source shop runtime.

## Scope

The public repository ships only the open-source default theme.

Official marketplace themes such as `eSIM Mall` and `Yevbi` are not bundled here. They are installed from the Jiffoo Marketplace after the merchant connects the instance to the platform.

## Theme package model

A theme package provides:

- page components
- design tokens
- default theme configuration
- optional helper UI components

## Typical structure

```text
packages/shop-themes/<theme-name>/
  src/
    index.ts
    tokens.css
    components/
  package.json
  tsconfig.json
```

## Required storefront surfaces

The default embedded theme model expects coverage for:

- home page
- products page
- product detail page
- cart page
- checkout page
- not-found page
- header
- footer

## Development notes

- use the shared storefront types from `packages/shared`
- keep theme packages framework-compatible with the open-source shop runtime
- avoid embedding marketplace-only assets in the public repository

## Reference

- default theme: `packages/shop-themes/default/`
- shared types: `packages/shared/`

# Jiffoo Mall Default Theme

The built-in Jiffoo theme is no longer just a bare storefront shell. It is the default launchpad template for:

- product sites
- landing-commerce homepages
- storefront-first sites
- SaaS websites that still want commerce and install flows close by

That means the same theme can power a branded landing page, installation and deployment CTA, docs/demo links, and a working catalog without switching stacks.

## Archetypes

The theme supports three homepage archetypes through `config.site.archetype`:

- `storefront`
- `landing-commerce`
- `product-site`

`product-site` is the strongest default for Jiffoo itself and for SaaS-style product websites that need:

- install and deploy CTA
- docs and demo entry points
- product explanation before catalog browsing
- commerce routes still available one click away

## Configuration

The built-in theme now supports a `site` section in theme config:

```ts
{
  brand: {
    name: 'Jiffoo'
  },
  site: {
    archetype: 'product-site',
    eyebrow: 'Open-source commerce operating system',
    headline: 'Install storefront, Admin, themes, plugins, and launch pages from one coherent stack.',
    subheadline: 'Use the same starter for a product site, SaaS landing page, or commerce-first experience.',
    primaryCtaLabel: 'One-click install',
    primaryCtaHref: 'https://get.jiffoo.com',
    secondaryCtaLabel: 'Explore the storefront',
    secondaryCtaHref: '/products',
    installCommand: 'curl -fsSL https://get.jiffoo.com | bash',
    docsHref: '/help',
    demoHref: '/products',
    supportEmail: 'hello@jiffoo.com'
  }
}
```

## Included Pages

- `HomePage`
- `ProductsPage`
- `ProductDetailPage`
- `CartPage`
- `CheckoutPage`
- `HelpPage`
- `ContactPage`
- `PrivacyPage`
- `TermsPage`
- `NotFound`

## Development

```bash
pnpm install
pnpm type-check
```

## Usage

The theme package is loaded by the shop application and acts as the built-in default. Merchants can keep it close to stock, or use it as a reusable base for broader SaaS/product-site experiences.

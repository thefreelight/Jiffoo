import React from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  LayoutTemplate,
  Package2,
  PanelTop,
  ServerCog,
  ShoppingBag,
} from 'lucide-react';
import type { HomePageProps } from '../../../../shared/src/types/theme';
import { isExternalHref, resolveSiteConfig } from '../site';

export const HomePage = React.memo(function HomePage({ config, onNavigate, t }: HomePageProps) {
  const [copied, setCopied] = React.useState(false);
  const site = resolveSiteConfig(config);
  const isProductSite = site.archetype === 'product-site';
  const isStorefront = site.archetype === 'storefront';

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const openHref = React.useCallback(
    (href: string) => {
      if (isExternalHref(href)) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      onNavigate?.(href);
    },
    [onNavigate]
  );

  const copyInstallCommand = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(site.installCommand);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error('Failed to copy install command', error);
    }
  }, [site.installCommand]);

  const deploymentLanes = [
    {
      name: getText('shop.home.deploy.oneClick', 'One-click install'),
      detail: getText(
        'shop.home.deploy.oneClickDescription',
        'Download the installer and bring the core stack up with one command.'
      ),
      command: site.installCommand,
    },
    {
      name: getText('shop.home.deploy.compose', 'Docker Compose'),
      detail: getText(
        'shop.home.deploy.composeDescription',
        'Pull the compose file, start services, and hand the first-run flow to the browser.'
      ),
      command: site.dockerComposeCommand,
    },
    {
      name: getText('shop.home.deploy.k8s', 'Kubernetes-ready'),
      detail: getText(
        'shop.home.deploy.k8sDescription',
        'Use the same stack model when you need rolling delivery, ingress, and cluster-aware upgrades.'
      ),
      command: getText('shop.home.deploy.k8sCommand', 'Helm / GitOps / operator path supported in the platform model'),
    },
  ];

  const pillars = [
    {
      title: getText('shop.home.pillars.theme', 'Theme system'),
      body: getText(
        'shop.home.pillars.themeBody',
        'Start with a launch-ready default theme, then switch to marketplace themes or custom renderers when the brand needs to evolve.'
      ),
      icon: LayoutTemplate,
    },
    {
      title: getText('shop.home.pillars.plugins', 'Plugins and marketplace'),
      body: getText(
        'shop.home.pillars.pluginsBody',
        'Install official and future third-party extensions through native Admin workspaces instead of shipping a page jungle into the product.'
      ),
      icon: Package2,
    },
    {
      title: getText('shop.home.pillars.operator', 'Operator surface'),
      body: getText(
        'shop.home.pillars.operatorBody',
        'Admin, install flows, updates, themes, and plugins stay close enough that operators can launch and iterate without stitching five products together.'
      ),
      icon: PanelTop,
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,oklch(0.95_0.03_65),transparent_32%),radial-gradient(circle_at_bottom_right,oklch(0.94_0.04_190),transparent_24%),linear-gradient(180deg,oklch(0.985_0.01_84),oklch(0.968_0.015_84))] text-[oklch(0.22_0.03_255)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklab,oklch(0.24_0.03_255)_8%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,oklch(0.24_0.03_255)_8%,transparent)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-[0.18]" />

      <section className="relative border-b border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-28 lg:px-10 lg:pb-24 lg:pt-32">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(21rem,0.9fr)] lg:items-start">
          <div className="max-w-4xl">
            <div className="mb-6 inline-flex items-center gap-3 border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_14%,transparent)] bg-[color:color-mix(in_oklab,oklch(0.97_0.014_84)_88%,white)] px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[oklch(0.42_0.04_250)]">
              <span className="h-2 w-2 rounded-full bg-[oklch(0.6_0.17_37)]" />
              {site.eyebrow}
            </div>

            <p className="mb-4 max-w-2xl text-[0.72rem] font-semibold uppercase tracking-[0.3em] text-[oklch(0.48_0.05_230)]">
              {isProductSite
                ? getText('shop.home.hero.modeProduct', 'Product-site archetype enabled')
                : isStorefront
                  ? getText('shop.home.hero.modeStorefront', 'Storefront archetype enabled')
                  : getText('shop.home.hero.modeLanding', 'Landing-commerce archetype enabled')}
            </p>

            <h1 className="max-w-5xl text-[clamp(3.35rem,7vw,7rem)] font-black leading-[0.94] tracking-[-0.06em] text-[oklch(0.22_0.03_255)]">
              {site.headline}
            </h1>

            <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-start">
              <p className="max-w-2xl text-[clamp(1.05rem,1.6vw,1.25rem)] leading-8 text-[oklch(0.35_0.03_250)]">
                {site.subheadline}
              </p>
              <div className="border-l border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] pl-5 text-sm leading-6 text-[oklch(0.41_0.04_225)]">
                <p>{getText('shop.home.hero.sideLabel', 'One default theme, three homepage personalities.')}</p>
                <p className="mt-3 font-medium text-[oklch(0.3_0.03_250)]">
                  {getText(
                    'shop.home.hero.sideModes',
                    'storefront / landing-commerce / product-site'
                  )}
                </p>
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => openHref(site.primaryCtaHref)}
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[oklch(0.28_0.05_255)] px-7 text-sm font-semibold uppercase tracking-[0.22em] text-[oklch(0.98_0.01_84)] transition-transform duration-300 hover:-translate-y-0.5"
              >
                {site.primaryCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openHref(site.secondaryCtaHref)}
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_16%,transparent)] px-7 text-sm font-semibold uppercase tracking-[0.22em] text-[oklch(0.28_0.05_255)] transition-colors duration-300 hover:bg-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_4%,transparent)]"
              >
                {site.secondaryCtaLabel}
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('/products')}
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full px-2 text-sm font-semibold uppercase tracking-[0.22em] text-[oklch(0.34_0.04_245)] transition-colors duration-300 hover:text-[oklch(0.22_0.03_255)]"
              >
                {getText('shop.home.hero.exploreProducts', 'Explore the catalog')}
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] bg-[linear-gradient(180deg,color-mix(in_oklab,oklch(0.985_0.012_84)_92%,white),color-mix(in_oklab,oklch(0.955_0.015_84)_78%,white))] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-[oklch(0.44_0.04_250)]">
                    {getText('shop.home.command.label', 'Launch command')}
                  </p>
                  <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[oklch(0.23_0.03_255)]">
                    {getText('shop.home.command.title', 'A landing theme that knows how to deploy itself.')}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={copyInstallCommand}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_14%,transparent)] text-[oklch(0.32_0.04_245)] transition-colors hover:bg-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_4%,transparent)]"
                  aria-label={getText('shop.home.command.copy', 'Copy install command')}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <div className="mt-5 overflow-hidden border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] bg-[oklch(0.23_0.03_255)] text-[oklch(0.95_0.01_84)]">
                <div className="flex items-center justify-between border-b border-[color:color-mix(in_oklab,oklch(0.97_0.01_84)_10%,transparent)] px-4 py-3 text-[0.7rem] uppercase tracking-[0.24em] text-[oklch(0.76_0.02_240)]">
                  <span>{getText('shop.home.command.ready', 'ready to paste')}</span>
                  <span>{copied ? getText('shop.home.command.copied', 'copied') : 'bash'}</span>
                </div>
                <div className="overflow-x-auto px-4 py-4 text-sm leading-7">
                  <code>{site.installCommand}</code>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: getText('shop.home.quick.admin', 'Admin'),
                  value: getText('shop.home.quick.adminValue', 'Native operator workspaces'),
                },
                {
                  label: getText('shop.home.quick.themes', 'Themes'),
                  value: getText('shop.home.quick.themesValue', 'Landing, storefront, and brand swaps'),
                },
                {
                  label: getText('shop.home.quick.plugins', 'Plugins'),
                  value: getText('shop.home.quick.pluginsValue', 'Marketplace-ready extension runtime'),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] bg-[color:color-mix(in_oklab,oklch(0.985_0.012_84)_88%,white)] p-4"
                >
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[oklch(0.46_0.03_245)]">
                    {item.label}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[oklch(0.3_0.03_250)]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="stack" className="relative px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="max-w-xl">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.26em] text-[oklch(0.46_0.04_245)]">
              {getText('shop.home.story.label', 'Why this default exists')}
            </p>
            <h2 className="mt-4 text-[clamp(2.2rem,4vw,4rem)] font-black leading-[0.97] tracking-[-0.05em] text-[oklch(0.22_0.03_255)]">
              {isProductSite
                ? getText('shop.home.story.titleProduct', 'The official site should prove the theme system can sell a product, not only list products.')
                : getText('shop.home.story.titleLanding', 'A strong default should introduce the offer before asking for the cart.')}
            </h2>
            <p className="mt-6 text-lg leading-8 text-[oklch(0.35_0.03_250)]">
              {getText(
                'shop.home.story.body',
                'The same built-in theme should carry installation CTA, stack explanation, and storefront discovery. That makes it useful for Jiffoo itself and reusable for other SaaS websites that need a product launchpad with commerce underneath.'
              )}
            </p>
          </div>

          <div className="grid gap-4">
            {pillars.map(({ title, body, icon: Icon }) => (
              <div
                key={title}
                className="grid gap-4 border-t border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_14%,transparent)] py-5 sm:grid-cols-[1.1rem_minmax(0,1fr)]"
              >
                <Icon className="mt-1 h-4 w-4 text-[oklch(0.54_0.08_170)]" />
                <div>
                  <h3 className="text-xl font-bold tracking-[-0.03em] text-[oklch(0.23_0.03_255)]">{title}</h3>
                  <p className="mt-2 max-w-2xl text-base leading-7 text-[oklch(0.36_0.03_248)]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="install" className="border-y border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] bg-[color:color-mix(in_oklab,oklch(0.97_0.014_84)_74%,white)] px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)] lg:items-end">
            <div className="max-w-md">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.26em] text-[oklch(0.46_0.04_245)]">
                {getText('shop.home.deploy.label', 'Go-live lanes')}
              </p>
              <h2 className="mt-4 text-[clamp(2rem,3.3vw,3.35rem)] font-black leading-[0.98] tracking-[-0.05em] text-[oklch(0.22_0.03_255)]">
                {getText('shop.home.deploy.title', 'Use the same default theme whether the site is installation-led or commerce-led.')}
              </h2>
            </div>
            <p className="max-w-3xl text-base leading-7 text-[oklch(0.37_0.03_248)]">
              {getText(
                'shop.home.deploy.body',
                'The homepage can carry installation and deployment guidance without losing the product and catalog paths. That is what makes this a SaaS starter instead of another anonymous shop skin.'
              )}
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {deploymentLanes.map((lane) => (
              <div
                key={lane.name}
                className="border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] bg-[oklch(0.985_0.008_84)] p-5"
              >
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[oklch(0.47_0.04_245)]">
                  {lane.name}
                </p>
                <p className="mt-3 text-sm leading-6 text-[oklch(0.34_0.03_248)]">{lane.detail}</p>
                <div className="mt-5 overflow-hidden border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_10%,transparent)] bg-[oklch(0.25_0.03_255)] px-4 py-4 text-sm leading-7 text-[oklch(0.94_0.01_84)]">
                  <code>{lane.command}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="max-w-md">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.26em] text-[oklch(0.46_0.04_245)]">
              {getText('shop.home.routes.label', 'What stays one click away')}
            </p>
            <h2 className="mt-4 text-[clamp(2rem,3vw,3.2rem)] font-black leading-[0.98] tracking-[-0.05em] text-[oklch(0.22_0.03_255)]">
              {getText('shop.home.routes.title', 'Landing content leads. Commerce routes stay alive behind it.')}
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {[
              {
                title: getText('shop.home.routes.catalog', 'Catalog and checkout'),
                body: getText(
                  'shop.home.routes.catalogBody',
                  'Products, cart, checkout, and customer flows remain intact, even when the homepage behaves like a product launchpad.'
                ),
                action: getText('shop.home.routes.catalogAction', 'Open products'),
                onClick: () => onNavigate?.('/products'),
                icon: ShoppingBag,
              },
              {
                title: getText('shop.home.routes.docs', 'Guides and docs'),
                body: getText(
                  'shop.home.routes.docsBody',
                  'Point the same template at install docs, deployment notes, or a deeper product walkthrough when the site needs more than a hero block.'
                ),
                action: getText('shop.home.routes.docsAction', 'Open guide'),
                onClick: () => openHref(site.docsHref),
                icon: ServerCog,
              },
            ].map(({ title, body, action, onClick, icon: Icon }) => (
              <button
                key={title}
                type="button"
                onClick={onClick}
                className="group border border-[color:color-mix(in_oklab,oklch(0.22_0.03_255)_12%,transparent)] bg-[color:color-mix(in_oklab,oklch(0.985_0.012_84)_90%,white)] p-6 text-left transition-transform duration-300 hover:-translate-y-1"
              >
                <Icon className="h-5 w-5 text-[oklch(0.55_0.1_170)]" />
                <h3 className="mt-4 text-xl font-bold tracking-[-0.03em] text-[oklch(0.22_0.03_255)]">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[oklch(0.35_0.03_248)]">{body}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.22em] text-[oklch(0.31_0.04_245)]">
                  {action}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
});

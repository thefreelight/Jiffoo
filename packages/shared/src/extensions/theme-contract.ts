export type ThemeTarget = 'shop' | 'admin';
export type ThemeManifest = {
  schemaVersion: 1;
  kind: 'theme';
  slug: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  target: ThemeTarget;
  tokens: Record<string, unknown>;
  fonts: Array<{ id: string; family: string; file: string; weight: number; style: 'normal' | 'italic'; license: string }>;
  settings: Array<{ id: string; type: string; label: Record<'en' | 'zh-Hans' | 'zh-Hant', string>; default: unknown; constraints: unknown; bindsToken?: string }>;
  copy: Record<string, Record<'en' | 'zh-Hans' | 'zh-Hant', string>>;
  assets: Record<string, string>;
  layout?: unknown;
};

export const SHOP_COLOR_ROLES = [
  'background', 'surface', 'surface-muted', 'text', 'text-muted', 'border',
  'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'accent',
  'success', 'warning', 'danger', 'header-bg', 'header-text', 'footer-bg',
  'footer-text', 'announcement-bg', 'announcement-text', 'price', 'sale-price',
] as const;
export const SHOP_LENGTH_ROLES = [
  'font-size-base', 'radius-sm', 'radius-md', 'radius-lg', 'button-radius',
  'card-radius', 'section-spacing', 'container-width',
] as const;
export const ADMIN_COLOR_ROLES = [
  'background', 'surface', 'surface-muted', 'text', 'text-muted', 'border',
  'primary', 'primary-foreground', 'sidebar-bg', 'sidebar-text',
  'sidebar-active-bg', 'sidebar-active-text', 'success', 'warning', 'danger', 'info',
  'foreground',
  'action-base', 'action-dark', 'action-deep', 'action-faint', 'action-light',
  'action-pale', 'action-soft', 'action-strong', 'action-veil',
  'alert-dark', 'alert-faint', 'alert-strong',
  'caution-base', 'caution-faint', 'caution-soft', 'caution-strong', 'caution-veil',
  'chart-amber-base', 'chart-cyan-base', 'chart-teal-light', 'chart-violet-base',
  'contrast-base', 'contrast-faint', 'contrast-strong',
  'cool-base', 'cool-faint', 'cool-ink', 'cool-light', 'cool-pale', 'cool-soft',
  'cool-strong', 'cool-veil',
  'danger-base', 'danger-dark', 'danger-deep', 'danger-deepest', 'danger-faint',
  'danger-light', 'danger-soft', 'danger-strong', 'danger-veil',
  'highlight-base', 'highlight-dark', 'highlight-deep', 'highlight-faint',
  'highlight-icon', 'highlight-soft', 'highlight-strong', 'highlight-veil',
  'neutral-base', 'neutral-dark', 'neutral-deep', 'neutral-deepest',
  'neutral-faint', 'neutral-light', 'neutral-pale', 'neutral-soft',
  'neutral-strong', 'neutral-veil',
  'positive-deep', 'positive-faint', 'positive-light', 'positive-pale',
  'positive-strong', 'positive-veil',
  'success-base', 'success-dark', 'success-deep', 'success-deepest',
  'success-faint', 'success-light', 'success-soft', 'success-strong', 'success-veil',
  'warning-base', 'warning-dark', 'warning-deep', 'warning-faint',
  'warning-strong', 'warning-veil',
  'highlight-faint-extra', 'install-background', 'install-foreground',
  'install-surface', 'media-surface', 'overlay-ink', 'page-surface',
] as const;
export const SECTION_TYPES = [
  'announcement-bar', 'hero-banner', 'image-carousel', 'category-list',
  'product-grid', 'image-with-text', 'text-block', 'feature-list',
] as const;

const object = (properties: Record<string, unknown>, required: string[] = []) =>
  ({ type: 'object', properties, required, additionalProperties: false });
const text = { type: 'string', minLength: 1, maxLength: 500, pattern: '^[^<>\\u0000-\\u001f]*$' };
const shortText = { ...text, maxLength: 100 };
const id = { type: 'string', pattern: '^[a-z][a-z0-9-]{0,63}$' };
const family = { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9 -]{0,99}$' };
const color = { type: 'string', pattern: '^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$' };
const length = { type: 'string', pattern: '^(?:0|[1-9][0-9]{0,3})(?:\\.[0-9]{1,4})?(?:px|rem)$' };
const signedLength = { type: 'string', pattern: '^-?(?:0|[1-9][0-9]{0,2})(?:\\.[0-9]{1,4})?(?:px|rem)$' };
const image = { type: 'string', pattern: '^assets/(?!.*(?:\\.\\.|//|/\\.))[a-zA-Z0-9_/-]+\\.(?:png|jpe?g|webp)$', maxLength: 250 };
const link = { type: 'string', pattern: '^(?:/(?!/)[^\\s<>]*|https://[^\\s<>]+)$', maxLength: 500 };
const localized = object({ en: text, 'zh-Hans': text, 'zh-Hant': text }, ['en', 'zh-Hans', 'zh-Hant']);
const settingReference = object({ $setting: id }, ['$setting']);
const value = (literal: unknown) => ({ anyOf: [literal, settingReference] });
const list = (items: unknown, maxItems = 20) => ({ type: 'array', items, maxItems });
const shadow = object(
  { x: signedLength, y: signedLength, blur: length, spread: signedLength, color },
  ['x', 'y', 'blur', 'spread', 'color'],
);
const sectionSettings: Record<string, unknown> = {
  'announcement-bar': object({ text: value(localized), link: value(link) }, ['text']),
  'hero-banner': object({ title: value(localized), body: value(localized), image: value(image), alt: value(localized), link: value(link), buttonLabel: value(localized) }, ['title']),
  'image-carousel': object({ slides: value({
    type: 'array', minItems: 1, maxItems: 8,
    items: object({ image, title: localized, alt: localized, link }, ['image', 'title']),
  }) }, ['slides']),
  'category-list': object({ title: value(localized), categoryIds: value(list(text)) }, ['title']),
  'product-grid': object({
    title: value(localized), source: value({ enum: ['latest', 'category', 'manual'] }),
    categoryId: value(text), productIds: value(list(text)),
    count: { type: 'integer', minimum: 1, maximum: 48 },
    columns: { type: 'integer', minimum: 1, maximum: 5 },
  }, ['title', 'source']),
  'image-with-text': object({
    image: value(image), alt: value(localized), title: value(localized),
    body: value(localized), link: value(link), position: { enum: ['left', 'right'] },
  }, ['image', 'title', 'body']),
  'text-block': object({ title: value(localized), body: value(localized) }, ['body']),
  'feature-list': object({
    items: value({ type: 'array', minItems: 1, maxItems: 8, items: object({
      title: localized, body: localized, icon: { enum: ['check', 'star', 'truck'] },
    }, ['title', 'body', 'icon']) }),
  }, ['items']),
};
const section = {
  oneOf: SECTION_TYPES.map((type) => object(
    { id, type: { const: type }, settings: sectionSettings[type] },
    ['id', 'type', 'settings'],
  )),
};
export const themeSectionSchemas = Object.fromEntries(
  SECTION_TYPES.map((type) => [type, object(
    { id, type: { const: type }, settings: sectionSettings[type] },
    ['id', 'type', 'settings'],
  )]),
);
const merchantLiteral = (schema: unknown): unknown => {
  if (Array.isArray(schema)) return schema.map(merchantLiteral);
  if (!schema || typeof schema !== 'object') return schema;
  const record = schema as Record<string, unknown>;
  if (Array.isArray(record.anyOf) && record.anyOf.some((item) =>
    !!item && typeof item === 'object' && '$setting' in ((item as { properties?: object }).properties ?? {})))
    return merchantLiteral(record.anyOf[0]);
  if (record.pattern === image.pattern)
    return { ...record, pattern: '^(?:assets/(?!.*(?:\\.\\.|//|/\\.))[a-zA-Z0-9_/-]+\\.(?:png|jpe?g|webp)|/uploads/products/[a-zA-Z0-9_-]+\\.(?:png|jpe?g|webp))$' };
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, merchantLiteral(item)]));
};
export const merchantSectionSchemas = Object.fromEntries(
  Object.entries(themeSectionSchemas).map(([type, schema]) => [type, merchantLiteral(schema)]),
);
const sections = { type: 'array', items: section, maxItems: 30 };
const shopLayout = object({
  header: object({
    variant: { enum: ['logo-left', 'logo-center'] },
    menu: { enum: ['inline', 'drawer'] },
    showSearch: { type: 'boolean' },
  }, ['variant', 'menu', 'showSearch']),
  footer: object({
    columns: { type: 'array', maxItems: 4, items: object({
      title: localized, text: localized,
      links: { type: 'array', maxItems: 8, items: object({ label: localized, href: link }, ['label', 'href']) },
    }, ['title', 'links', 'text']) },
  }, ['columns']),
  pages: object({
    home: object({ sections }, ['sections']),
    category: object({ columns: { type: 'integer', minimum: 2, maximum: 5 }, showFilters: { type: 'boolean' } }, ['columns', 'showFilters']),
    product: object({ gallery: { enum: ['left', 'right'] }, showRelatedProducts: { type: 'boolean' } }, ['gallery', 'showRelatedProducts']),
  }, ['home', 'category', 'product']),
  slots: object({
    'category.top': sections, 'category.bottom': sections, 'product.bottom': sections,
  }, ['category.top', 'category.bottom', 'product.bottom']),
}, ['header', 'footer', 'pages', 'slots']);

const shopTokens = object({
  ...Object.fromEntries(SHOP_COLOR_ROLES.map((role) => [role, color])),
  ...Object.fromEntries(SHOP_LENGTH_ROLES.map((role) => [role, length])),
  'font-body': id, 'font-heading': id,
  'type-scale': { type: 'number', minimum: 1, maximum: 2 },
  'heading-weight': { type: 'integer', minimum: 100, maximum: 900 },
  'button-style': { enum: ['solid', 'outline'] },
  'card-shadow': shadow,
});
const adminTokens = object({
  ...Object.fromEntries(ADMIN_COLOR_ROLES.map((role) => [role, color])),
  'font-body': id, 'radius-sm': length, 'radius-md': length,
  'radius-lg': length, 'card-shadow': shadow,
  density: { enum: ['compact', 'comfortable'] },
});
const settings = {
  type: 'array', maxItems: 100,
  items: {
    oneOf: [
      ['color', color, object({})],
      ['text', localized, object({ maxLength: { type: 'integer', minimum: 1, maximum: 500 } }, ['maxLength'])],
      ['image', { anyOf: [image, { type: 'string', pattern: '^/uploads/products/[a-zA-Z0-9_-]+\\.(?:png|jpe?g|webp)$' }] }, object({})],
      ['category', text, object({})],
      ['product-list', list(text), object({ maxItems: { type: 'integer', minimum: 1, maximum: 20 } }, ['maxItems'])],
      ['boolean', { type: 'boolean' }, object({})],
      ['select', text, object({ options: { type: 'array', minItems: 1, maxItems: 20, items: shortText, uniqueItems: true } }, ['options'])],
      ['number', { type: 'number' }, object({
        min: { type: 'number' }, max: { type: 'number' }, step: { type: 'number', exclusiveMinimum: 0 },
      }, ['min', 'max', 'step'])],
      ['link', link, object({})],
    ].map(([type, defaultValue, constraints]) => object({
      id, type: { const: type }, label: localized, default: defaultValue,
      constraints, bindsToken: id,
    }, ['id', 'type', 'label', 'default', 'constraints'])),
  },
};
const common = {
  schemaVersion: { const: 1 }, kind: { const: 'theme' },
  slug: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,30}[a-z0-9]$' },
  name: shortText, version: { type: 'string', pattern: '^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$' },
  description: text, author: shortText, license: shortText,
  fonts: { type: 'array', maxItems: 20, items: object({
    id, family,
    file: { type: 'string', pattern: '^fonts/(?!.*(?:\\.\\.|//|/\\.))[a-zA-Z0-9_/-]+\\.woff2$', maxLength: 250 },
    weight: { type: 'integer', minimum: 100, maximum: 900 },
    style: { enum: ['normal', 'italic'] }, license: shortText,
  }, ['id', 'family', 'file', 'weight', 'style', 'license']) },
  settings, copy: {
    type: 'object', patternProperties: { '^[a-z][a-z0-9-]{0,63}$': localized },
    additionalProperties: false, maxProperties: 200,
  },
};
const required = [
  'schemaVersion', 'kind', 'slug', 'name', 'version', 'description', 'author',
  'license', 'target', 'tokens', 'fonts', 'settings', 'copy', 'assets',
];
export const themeManifestSchema = {
  oneOf: [
    object({
      ...common, target: { const: 'shop' }, tokens: shopTokens,
      assets: object({}), layout: shopLayout,
    }, [...required, 'layout']),
    object({
      ...common, target: { const: 'admin' }, tokens: adminTokens,
      assets: object({ logo: image, 'login-background': image }),
    }, required),
  ],
} as const;

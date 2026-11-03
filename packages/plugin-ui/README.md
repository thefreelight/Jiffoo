# @jiffoo/plugin-ui

The presentation layer of a Core plugin page, version 1.0.0-alpha.2.

A plugin page runs in an opaque iframe (`sandbox="allow-scripts allow-forms"`),
so the stylesheet of Core does not reach it. The Core shell sends the theme
variables of the surface to the frame and the bridge writes them onto `:root`
of the frame document, under their neutral names (`--core-ground`,
`--extras-primary`, ...). This package turns those neutral names into a
stable token set and a small component set on top of them.

The package ships CSS only. It has no JavaScript, no dependencies, no
development dependencies and no workspace references, so it installs outside
the monorepo like any other stylesheet package.

```sh
npm i ./jiffoo-plugin-ui-1.0.0-alpha.2.tgz
```

```html
<link rel="stylesheet" href="/node_modules/@jiffoo/plugin-ui/dist/tokens.css" />
<link rel="stylesheet" href="/node_modules/@jiffoo/plugin-ui/dist/styles.css" />
```

`tokens.css` declares the `--jpu-*` tokens. `styles.css` declares the
components and reads nothing but the `--jpu-*` tokens, so the same stylesheet
renders in the storefront and in the administration.

The tokens are:

- Layout: `--jpu-page` is the page frame, `--jpu-stack` is a vertical group,
  `--jpu-row` a horizontal one, `--jpu-divider` a rule.
- Text: `--jpu-heading`, `--jpu-heading--lg`, `--jpu-text`,
  `--jpu-text--muted`, `--jpu-code`.
- Containers: `--jpu-card`.
- Buttons: `--jpu-btn` with `--primary`, `--secondary`, `--outline`, `--ghost`,
  `--danger` and the sizes `--sm` and `--lg`.
- Forms: `--jpu-field`, `--jpu-label`, `--jpu-input`, `--jpu-textarea`,
  `--jpu-hint`, `--jpu-error`.
- States: `--jpu-badge` with `--neutral`, `--success`, `--warning`, `--danger`,
  `--jpu-status`, `--jpu-empty`.
- Loading: `--jpu-spinner`, drawn with CSS alone, because the plugin asset
  rules of Core reject SVG.

The dark mode of Core needs no branch here: the bridge writes the values of
the mode in force, so the tokens of the frame are already the dark ones.

The size of the text that inherits follows the theme token `--jpu-font-size`,
which reads `--extras-font-size-base` of the theme. Every size that carries a
role is a fixed rem that matches the Tailwind scale of the storefront one for
one, so a plugin page and the storefront share one typographic system.

From the repository, `pnpm --filter @jiffoo/plugin-ui build` publishes the two
stylesheets into `dist`, and
`node --test scripts/plugin-ui-standalone.test.mjs` is the audited,
database-free check that the packed tarball installs outside the monorepo and
carries the bytes of the tree build.

Each Core release distributes the package as a release artifact next to the
SDK and the bridge tarballs. Pre-releases use 1.0.0-alpha.N. npm publishing is
deferred until the owner provides an npm organisation.

A consumer that vendors the tarball records the Core commit it came from and
the tarball's SHA256 beside the file, so that the bytes stay traceable to a
tree.

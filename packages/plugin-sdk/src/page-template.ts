// The frontend scaffold of `jiffoo-plugin create --pages`.
//
// The generated page is a plain Vite application that talks to Core through
// the plugin bridge and takes every visual decision from the Core theme
// tokens. The templates live in their own module so that the server-side
// scaffold stays readable; they are not part of the public export surface of
// the SDK.

export interface PageScaffold {
  /** The manifest `ui` declaration of the generated plugin. */
  manifestUi: {
    bridgeVersion: 1;
    assetDirectory: string;
    storefrontPages: Array<{
      id: string;
      path: string;
      entry: string;
      title: { en: string; 'zh-Hans': string; 'zh-Hant': string };
      placements: string[];
      requiresLogin: boolean;
    }>;
    adminPages: Array<{
      id: string;
      path: string;
      entry: string;
      title: { en: string; 'zh-Hans': string; 'zh-Hant': string };
    }>;
  };
  /** The files of the generated plugin, keyed by their package-relative path. */
  files: Record<string, string>;
}

const entryTemplate = `import { createPluginBridge, type PageContext } from '@jiffoo/plugin-bridge';
import '@jiffoo/plugin-ui/tokens.css';
import '@jiffoo/plugin-ui/styles.css';
import './styles.css';

// Every element is built with DOM calls and plain text. The page carries no
// inline style and no hardcoded color, radius or spacing: the plugin UI
// stylesheet and the Core theme tokens own the appearance.
function render(context: PageContext): void {
  const host = document.querySelector('#app');
  if (!host) return;
  const page = document.createElement('div');
  page.className = 'jpu-page';
  const card = document.createElement('section');
  card.className = 'jpu-card';
  const heading = document.createElement('h1');
  heading.className = 'jpu-heading';
  heading.textContent = context.store.name;
  const summary = document.createElement('p');
  summary.className = 'jpu-text';
  summary.textContent = 'This page is served by the plugin inside the Core page shell.';
  const detail = document.createElement('p');
  detail.className = 'jpu-text jpu-text--muted';
  detail.textContent = context.page.path + ' - ' + context.locale;
  const action = document.createElement('button');
  action.className = 'jpu-btn jpu-btn--primary';
  action.type = 'button';
  action.textContent = 'Reload the page';
  action.addEventListener('click', () => { window.location.reload(); });
  card.append(heading, summary, detail, action);
  page.append(card);
  host.replaceChildren(page);
}

async function main(): Promise<void> {
  try {
    // The bridge connects this page to the Core page shell. It hands over the
    // page context once the shell has answered the handshake.
    const bridge = createPluginBridge();
    await bridge.ready;
    render(await bridge.context());
    await bridge.subscribe(context => { render(context); });
  } catch {
    const host = document.querySelector('#app');
    if (host) host.textContent = 'Open this page from your store.';
  }
}

void main();
`;

const htmlTemplate = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>__TITLE__</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./entry.ts"></script>
  </body>
</html>
`;

const stylesTemplate = `/* Page specific styles of this plugin.
 *
 * The design system lives in @jiffoo/plugin-ui: tokens.css maps the Core theme
 * variables onto the plugin tokens and styles.css provides the component
 * classes. Add rules here only for what the design system does not cover, and
 * take the colors, the radius and the spacing from the theme tokens instead
 * of hardcoding them.
 */
`;

const viteConfigTemplate = `import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

// The Core serves the plugin assets from its own origin, so every asset URL
// has to stay relative to the page.
export default defineConfig({
  root,
  base: './',
  publicDir: false,
  build: {
    outDir: path.resolve(root, '../dist/package/ui'),
    emptyOutDir: true,
    sourcemap: false,
    modulePreload: false,
    rollupOptions: { input: { index: path.resolve(root, 'index.html') } },
  },
});
`;

/**
 * The frontend scaffold of a plugin: the manifest declaration, the page
 * sources and the Vite configuration that builds them into the package.
 */
export function pageScaffold(name: string): PageScaffold {
  const title = { en: 'Studio', 'zh-Hans': '工作室', 'zh-Hant': '工作台' };
  return {
    manifestUi: {
      bridgeVersion: 1,
      assetDirectory: 'ui',
      storefrontPages: [{
        id: 'studio',
        path: '/studio',
        entry: 'index.html',
        title,
        placements: ['header-nav'],
        requiresLogin: false,
      }],
      adminPages: [{
        id: 'studio',
        path: '/studio',
        entry: 'index.html',
        title,
      }],
    },
    files: {
      'ui/index.html': htmlTemplate.replace('__TITLE__', name),
      'ui/entry.ts': entryTemplate,
      'ui/styles.css': stylesTemplate,
      'ui/vite.config.mts': viteConfigTemplate,
    },
  };
}

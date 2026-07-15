#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

function findEsbuildModule() {
  const directCandidate = path.join(REPO_ROOT, 'node_modules', 'esbuild', 'lib', 'main.js');
  if (fs.existsSync(directCandidate)) {
    return directCandidate;
  }

  const pnpmDir = path.join(REPO_ROOT, 'node_modules', '.pnpm');
  if (!fs.existsSync(pnpmDir)) {
    throw new Error(`pnpm store directory not found: ${pnpmDir}`);
  }

  const entries = fs.readdirSync(pnpmDir).filter((entry) => entry.startsWith('esbuild@')).sort().reverse();
  for (const entry of entries) {
    const candidate = path.join(pnpmDir, entry, 'node_modules', 'esbuild', 'lib', 'main.js');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to resolve esbuild from node_modules/.pnpm');
}

async function loadEsbuild() {
  const modulePath = findEsbuildModule();
  const mod = await import(pathToFileURL(modulePath).href);
  return mod.default || mod;
}

function themeHostBridgePlugin() {
  return {
    name: 'theme-host-bridge',
    setup(build) {
      build.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'theme-host' }));
      build.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: 'react/jsx-runtime', namespace: 'theme-host' }));

      build.onLoad({ filter: /^react$/, namespace: 'theme-host' }, () => ({
        loader: 'js',
        contents: `
          const React = globalThis.__JIFFOO_THEME_HOST__?.React;
          if (!React) {
            throw new Error('Theme runtime host bridge is missing React');
          }
          export default React;
          export const Children = React.Children;
          export const Component = React.Component;
          export const Fragment = React.Fragment;
          export const Suspense = React.Suspense;
          export const cloneElement = React.cloneElement;
          export const createContext = React.createContext;
          export const createElement = React.createElement;
          export const createRef = React.createRef;
          export const forwardRef = React.forwardRef;
          export const isValidElement = React.isValidElement;
          export const lazy = React.lazy;
          export const memo = React.memo;
          export const startTransition = React.startTransition;
          export const useCallback = React.useCallback;
          export const useContext = React.useContext;
          export const useDeferredValue = React.useDeferredValue;
          export const useEffect = React.useEffect;
          export const useId = React.useId;
          export const useImperativeHandle = React.useImperativeHandle;
          export const useInsertionEffect = React.useInsertionEffect || React.useLayoutEffect;
          export const useLayoutEffect = React.useLayoutEffect;
          export const useMemo = React.useMemo;
          export const useReducer = React.useReducer;
          export const useRef = React.useRef;
          export const useState = React.useState;
          export const useTransition = React.useTransition;
        `,
      }));

      build.onLoad({ filter: /^react\/jsx-runtime$/, namespace: 'theme-host' }, () => ({
        loader: 'js',
        contents: `
          const runtime = globalThis.__JIFFOO_THEME_HOST__?.jsxRuntime;
          if (!runtime) {
            throw new Error('Theme runtime host bridge is missing react/jsx-runtime');
          }
          export const Fragment = runtime.Fragment;
          export const jsx = runtime.jsx;
          export const jsxs = runtime.jsxs;
          export const jsxDEV = runtime.jsxDEV;
        `,
      }));
    },
  };
}

async function buildThemeRuntimeBundle() {
  const manifestPath = path.join(__dirname, 'theme-pack', 'theme.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const runtimePath = manifest?.entry?.runtimeJS;

  if (!runtimePath) {
    return null;
  }

  const esbuild = await loadEsbuild();
  const outfile = path.join(__dirname, 'theme-pack', runtimePath);
  const tokensCss = fs.readFileSync(path.join(__dirname, 'src', 'tokens.css'), 'utf8');

  fs.mkdirSync(path.dirname(outfile), { recursive: true });

  await esbuild.build({
    stdin: {
      contents: `
        import theme from './src/runtime.ts';
        const tokenStyleId = 'bokmoo-runtime-tokens';
        let tokenStyle = document.getElementById(tokenStyleId);
        if (!tokenStyle) {
          tokenStyle = document.createElement('style');
          tokenStyle.id = tokenStyleId;
          document.head.appendChild(tokenStyle);
        }
        tokenStyle.textContent = ${JSON.stringify(tokensCss)};
        const existingMeta =
          theme && typeof theme === 'object' && theme.meta && typeof theme.meta === 'object'
            ? theme.meta
            : {};
        window.__JIFFOO_THEME_RUNTIME__ = {
          ...theme,
          meta: {
            ...existingMeta,
            slug: ${JSON.stringify(manifest.slug)},
            version: ${JSON.stringify(manifest.version)},
            target: ${JSON.stringify(manifest.target || 'shop')},
          },
        };
      `,
      resolveDir: __dirname,
      sourcefile: `${manifest.slug || 'theme'}-theme-runtime-entry.ts`,
      loader: 'ts',
    },
    outfile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    sourcemap: false,
    legalComments: 'none',
    plugins: [themeHostBridgePlugin()],
  });

  return outfile;
}

buildThemeRuntimeBundle().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

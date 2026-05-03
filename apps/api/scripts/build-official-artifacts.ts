import archiver from 'archiver';
import * as esbuild from 'esbuild';
import { spawn } from 'child_process';
import { createHash, sign } from 'crypto';
import { createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import {
  OFFICIAL_LAUNCH_EXTENSIONS,
  type OfficialCatalogEntry,
} from '../../../packages/shared/src/extensions/official-catalog';

type OfficialArtifactKind = 'plugin' | 'theme';

interface PluginSourceConfig {
  includeNodeModules?: boolean;
  prepareCommands?: string[];
}

interface PreparedPluginSource {
  cleanup(): Promise<void>;
}

interface PluginPackageJson {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface BuildOfficialArtifactsOptions {
  outputDir?: string;
  artifactBaseUrl?: string;
  slugs?: string[];
  kinds?: OfficialArtifactKind[];
}

interface BuiltArtifactSummary {
  slug: string;
  kind: OfficialArtifactKind;
  version: string;
  packageUrl: string;
  filePath: string;
  relativePath: string;
  sha256: string;
  sizeBytes: number;
  sourceDir: string;
  includedFiles: string[];
  signaturePath?: string;
}

interface ThemePackSourceManifest {
  schemaVersion: number;
  slug: string;
  name: string;
  version: string;
  target: 'shop' | 'admin';
  entry?: {
    tokensCSS?: string;
    runtimeJS?: string;
    templatesDir?: string;
    assetsDir?: string;
    settingsSchema?: string;
    presetsDir?: string;
  };
  compatibility?: {
    minCoreVersion?: string;
  };
  'x-jiffoo-renderer-mode'?: 'platform' | 'embedded';
  'x-jiffoo-renderer-slug'?: string;
}

interface BuildOfficialArtifactsResult {
  generatedAt: string;
  outputDir: string;
  items: BuiltArtifactSummary[];
}

const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, 'dist', 'official-artifacts');
const ROOT_LICENSE_PATH = path.join(REPO_ROOT, 'LICENSE');

const OFFICIAL_PLUGIN_SOURCE_CONFIG: Record<string, PluginSourceConfig> = {
  stripe: {
    includeNodeModules: false,
  },
  i18n: {
    includeNodeModules: false,
  },
  odoo: {
    includeNodeModules: true,
    prepareCommands: [
      'npm ci --include=dev',
      'npm run build',
      'rm -rf node_modules',
      'npm ci --omit=dev',
    ],
  },
};

function parseArgs(argv: string[]): BuildOfficialArtifactsOptions {
  const options: BuildOfficialArtifactsOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--output' || arg === '-o') {
      options.outputDir = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--slug') {
      const value = argv[index + 1];
      if (value) {
        options.slugs = [...(options.slugs || []), value];
      }
      index += 1;
      continue;
    }

    if (arg === '--kind') {
      const value = argv[index + 1];
      if (value === 'plugin' || value === 'theme') {
        options.kinds = [...(options.kinds || []), value];
      }
      index += 1;
      continue;
    }

    if (arg === '--artifact-base-url') {
      options.artifactBaseUrl = argv[index + 1];
      index += 1;
      continue;
    }
  }

  return options;
}

function toOfficialArtifactKind(entry: OfficialCatalogEntry): OfficialArtifactKind {
  return entry.kind === 'plugin' ? 'plugin' : 'theme';
}

function getDefaultPackageUrl(entry: OfficialCatalogEntry, artifactBaseUrl?: string): string {
  if (!artifactBaseUrl) {
    return entry.packageUrl;
  }

  const extension = entry.kind === 'theme' ? 'jtheme' : 'jplugin';
  const kindPath = entry.kind === 'theme' ? 'themes' : 'plugins';
  return `${artifactBaseUrl.replace(/\/$/, '')}/${kindPath}/${entry.slug}/${entry.version}.${extension}`;
}

function sanitizeManifestEntryRoot(entryModule?: string): string | null {
  if (!entryModule) {
    return null;
  }

  const normalized = entryModule.replace(/\\/g, '/').replace(/^\.?\//, '');
  const [segment] = normalized.split('/');
  return segment || null;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(targetPath: string): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true });
}

async function runShellCommand(command: string, cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      env: process.env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed with exit code ${code}: ${command}`));
    });
  });
}

async function copyIfExists(sourcePath: string, destPath: string): Promise<boolean> {
  if (!(await pathExists(sourcePath))) {
    return false;
  }

  await ensureDir(path.dirname(destPath));
  await fs.cp(sourcePath, destPath, { recursive: true, force: true });
  return true;
}

async function writeProductionPluginPackageJson(
  pluginSlug: string,
  sourcePackageJsonPath: string,
  stagingPackageJsonPath: string,
  hasPrismaSchema: boolean,
): Promise<void> {
  const packageJson = JSON.parse(await fs.readFile(sourcePackageJsonPath, 'utf-8')) as PluginPackageJson;
  const dependencies = { ...(packageJson.dependencies || {}) };

  if (hasPrismaSchema && packageJson.devDependencies?.prisma && !dependencies.prisma) {
    dependencies.prisma = packageJson.devDependencies.prisma;
  }

  const productionPackageJson: PluginPackageJson = {
    name: packageJson.name || `@jiffoo/official-plugin-${pluginSlug}`,
    version: packageJson.version,
    description: packageJson.description,
    main: packageJson.main || 'dist/index.js',
    dependencies,
    license: packageJson.license,
  };

  await ensureDir(path.dirname(stagingPackageJsonPath));
  await fs.writeFile(
    stagingPackageJsonPath,
    `${JSON.stringify(productionPackageJson, null, 2)}\n`,
    'utf-8',
  );
}

async function installPluginProductionDependencies(stagingDir: string): Promise<void> {
  await runShellCommand('npm install --omit=dev --ignore-scripts --no-audit --no-fund', stagingDir);
}

async function generateStagedPluginPrismaClient(stagingDir: string): Promise<void> {
  const prismaBinaryPath = path.join(stagingDir, 'node_modules', '.bin', 'prisma');
  const prismaCommand = (await pathExists(prismaBinaryPath))
    ? `${JSON.stringify(prismaBinaryPath)} generate --schema prisma/schema.prisma`
    : 'npx prisma generate --schema prisma/schema.prisma';

  await runShellCommand(prismaCommand, stagingDir);
}

async function gatherFiles(dir: string, prefix = ''): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      files.push(...(await gatherFiles(absolutePath, relativePath)));
      continue;
    }

    files.push(relativePath.replace(/\\/g, '/'));
  }

  return files.sort();
}

function shouldRemoveExecutableArtifactFile(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  if (isAllowedBundledPluginRuntimeBinary(normalized)) {
    return false;
  }

  if (normalized.endsWith('.map')) {
    return true;
  }

  if (
    normalized.endsWith('.sh') ||
    normalized.endsWith('.bat') ||
    normalized.endsWith('.cmd') ||
    normalized.endsWith('.ps1') ||
    normalized.endsWith('.exe') ||
    normalized.endsWith('.dll') ||
    normalized.endsWith('.so') ||
    normalized.endsWith('.dylib')
  ) {
    return true;
  }

  if (normalized.endsWith('/xdg-open') || normalized.includes('/schema-engine-')) {
    return true;
  }

  if (
    normalized.endsWith('.ts') ||
    normalized.endsWith('.tsx') ||
    normalized.endsWith('.jsx') ||
    normalized.endsWith('.mts') ||
    normalized.endsWith('.cts')
  ) {
    return !(
      normalized.endsWith('.d.ts') ||
      normalized.endsWith('.d.mts') ||
      normalized.endsWith('.d.cts')
    );
  }

  return false;
}

function isAllowedBundledPluginRuntimeBinary(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  const isNodeBinary = normalized.endsWith('.node');
  const isSharpSharedLibrary =
    normalized.includes('node_modules/@img/sharp-libvips-') &&
    (normalized.endsWith('.dylib') ||
      normalized.endsWith('.so') ||
      normalized.includes('.so.') ||
      normalized.endsWith('.dll'));

  return (
    (isNodeBinary &&
      (/(^|\/)node_modules\/\.prisma\/(client|[^/]+-client)\//.test(normalized) ||
        normalized.includes('node_modules/@prisma/engines/') ||
        normalized.includes('node_modules/prisma/') ||
        normalized.includes('node_modules/@img/sharp-') ||
        normalized.includes('node_modules/sharp/'))) ||
    isSharpSharedLibrary
  );
}

function shouldRemoveBundledPluginPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();

  if (normalized === 'node_modules/.bin' || normalized.startsWith('node_modules/.bin/')) {
    return true;
  }

  if (normalized === 'node_modules/@rollup' || normalized.startsWith('node_modules/@rollup/')) {
    return true;
  }

  if (normalized === 'node_modules/fsevents' || normalized.startsWith('node_modules/fsevents/')) {
    return true;
  }

  if (normalized.includes('/test/') || normalized.includes('/tests/') || normalized.includes('/integration/')) {
    return true;
  }

  if (normalized.endsWith('.node') && !isAllowedBundledPluginRuntimeBinary(normalized)) {
    return true;
  }

  return false;
}

async function pruneExecutablePackageArtifacts(stagingDir: string): Promise<void> {
  const files = await gatherFiles(stagingDir);
  const pluginPathsToRemove = Array.from(
    new Set(
      files
        .filter((relativePath) => shouldRemoveBundledPluginPath(relativePath))
        .map((relativePath) => {
          const normalized = relativePath.replace(/\\/g, '/');
          if (normalized.startsWith('node_modules/@rollup/')) {
            return 'node_modules/@rollup';
          }
          if (normalized.startsWith('node_modules/fsevents/')) {
            return 'node_modules/fsevents';
          }
          if (normalized.startsWith('node_modules/.bin/')) {
            return 'node_modules/.bin';
          }
          return normalized;
        }),
    ),
  ).sort((left, right) => right.length - left.length);

  await Promise.all(
    pluginPathsToRemove.map((relativePath) =>
      fs.rm(path.join(stagingDir, relativePath), { recursive: true, force: true }),
    ),
  );

  await Promise.all(
    files
      .filter((relativePath) => shouldRemoveExecutableArtifactFile(relativePath))
      .map((relativePath) => fs.rm(path.join(stagingDir, relativePath), { force: true })),
  );
}

async function calculateFileSha256(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

async function writeChecksumsJson(stagingDir: string): Promise<Record<string, string>> {
  const files = await gatherFiles(stagingDir);
  const checksums: Record<string, string> = {};

  for (const relativePath of files) {
    if (relativePath === 'checksums.json') {
      continue;
    }
    checksums[relativePath] = await calculateFileSha256(path.join(stagingDir, relativePath));
  }

  await fs.writeFile(
    path.join(stagingDir, 'checksums.json'),
    JSON.stringify(checksums, null, 2),
    'utf-8',
  );

  return checksums;
}

async function ensurePluginSourcePrepared(
  sourceDir: string,
  manifest: { entryModule?: string },
  config: PluginSourceConfig,
): Promise<PreparedPluginSource> {
  const entryRoot = sanitizeManifestEntryRoot(manifest.entryModule);
  const entryRootPath = entryRoot ? path.join(sourceDir, entryRoot) : null;
  const nodeModulesPath = path.join(sourceDir, 'node_modules');
  const needsEntryRoot = entryRootPath ? !(await pathExists(entryRootPath)) : false;
  const needsNodeModules = Boolean(config.includeNodeModules) && !(await pathExists(nodeModulesPath));

  if (!needsEntryRoot && !needsNodeModules) {
    return {
      async cleanup() {},
    };
  }

  const createdPaths: string[] = [];

  if (!config.prepareCommands?.length) {
    const missingTargets = [
      ...(needsEntryRoot && entryRoot ? [`entry root "${entryRoot}"`] : []),
      ...(needsNodeModules ? ['node_modules'] : []),
    ].join(', ');
    throw new Error(`Plugin source for ${sourceDir} is missing ${missingTargets} and no prepareCommands are configured`);
  }

  for (const command of config.prepareCommands) {
    await runShellCommand(command, sourceDir);
  }

  if (needsEntryRoot && entryRootPath && (await pathExists(entryRootPath))) {
    createdPaths.push(entryRootPath);
  }

  if (needsNodeModules && (await pathExists(nodeModulesPath))) {
    createdPaths.push(nodeModulesPath);
  }

  return {
    async cleanup() {
      for (const targetPath of createdPaths.sort((left, right) => right.length - left.length)) {
        await fs.rm(targetPath, { recursive: true, force: true });
      }
    },
  };
}

async function createZipArchive(sourceDir: string, outputFilePath: string): Promise<void> {
  await ensureDir(path.dirname(outputFilePath));

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outputFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize().catch(reject);
  });
}

async function maybeWriteDetachedSignature(outputFilePath: string): Promise<string | undefined> {
  const privateKeyPath = process.env.OFFICIAL_EXTENSION_SIGNING_KEY_PATH;
  const privateKeyPem = process.env.OFFICIAL_EXTENSION_SIGNING_KEY;
  const keyMaterial = privateKeyPem || (privateKeyPath ? await fs.readFile(privateKeyPath, 'utf-8') : null);

  if (!keyMaterial) {
    return undefined;
  }

  const artifactBuffer = await fs.readFile(outputFilePath);
  const artifactHash = createHash('sha256').update(artifactBuffer).digest();
  const signatureBase64 = sign(null, artifactHash, keyMaterial).toString('base64');
  const signaturePath = `${outputFilePath}.sig`;
  await fs.writeFile(signaturePath, signatureBase64, 'utf-8');
  return signaturePath;
}

async function writeArtifactSidecars(outputFilePath: string): Promise<{
  sha256: string;
  sizeBytes: number;
  signaturePath?: string;
}> {
  const stat = await fs.stat(outputFilePath);
  const sha256 = await calculateFileSha256(outputFilePath);
  await fs.writeFile(`${outputFilePath}.sha256`, `${sha256}  ${path.basename(outputFilePath)}\n`, 'utf-8');
  const signaturePath = await maybeWriteDetachedSignature(outputFilePath);
  return {
    sha256,
    sizeBytes: stat.size,
    signaturePath,
  };
}

async function stagePluginArtifact(entry: OfficialCatalogEntry, stagingDir: string): Promise<string[]> {
  const sourceDir = path.join(REPO_ROOT, 'extensions', 'plugins', entry.slug);
  const manifestPath = path.join(sourceDir, 'manifest.json');
  const packageJsonPath = path.join(sourceDir, 'package.json');
  const readmePath = path.join(sourceDir, 'README.md');
  const localLicensePath = path.join(sourceDir, 'LICENSE');
  const prismaDir = path.join(sourceDir, 'prisma');
  const prismaSchemaPath = path.join(prismaDir, 'schema.prisma');
  const config = OFFICIAL_PLUGIN_SOURCE_CONFIG[entry.slug] || {};

  if (!(await pathExists(manifestPath))) {
    throw new Error(`Plugin manifest not found for ${entry.slug}: ${manifestPath}`);
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as {
    version?: string;
    entryModule?: string;
  };
  const packageJson = (await pathExists(packageJsonPath))
    ? (JSON.parse(await fs.readFile(packageJsonPath, 'utf-8')) as { version?: string })
    : null;

  if (manifest.version && manifest.version !== entry.version) {
    throw new Error(
      `Plugin ${entry.slug} manifest version ${manifest.version} does not match official catalog version ${entry.version}`,
    );
  }

  if (packageJson?.version && packageJson.version !== entry.version) {
    throw new Error(
      `Plugin ${entry.slug} package.json version ${packageJson.version} does not match official catalog version ${entry.version}`,
    );
  }

  const preparedSource = await ensurePluginSourcePrepared(sourceDir, manifest, config);

  try {
    await copyIfExists(manifestPath, path.join(stagingDir, 'manifest.json'));
    if (await pathExists(packageJsonPath)) {
      await writeProductionPluginPackageJson(
        entry.slug,
        packageJsonPath,
        path.join(stagingDir, 'package.json'),
        await pathExists(prismaSchemaPath),
      );
    }
    await copyIfExists(readmePath, path.join(stagingDir, 'README.md'));
    await copyIfExists(localLicensePath, path.join(stagingDir, 'LICENSE'));
    await copyIfExists(prismaDir, path.join(stagingDir, 'prisma'));

    if (!(await pathExists(path.join(stagingDir, 'LICENSE')))) {
      await copyIfExists(ROOT_LICENSE_PATH, path.join(stagingDir, 'LICENSE'));
    }

    const entryRoot = sanitizeManifestEntryRoot(manifest.entryModule);
    if (entryRoot) {
      const sourceEntryRoot = path.join(sourceDir, entryRoot);
      if (!(await pathExists(sourceEntryRoot))) {
        throw new Error(`Plugin entry root "${entryRoot}" not found for ${entry.slug}`);
      }
      await fs.cp(sourceEntryRoot, path.join(stagingDir, entryRoot), {
        recursive: true,
        force: true,
      });
    }

    if (config.includeNodeModules) {
      const nodeModulesPath = path.join(sourceDir, 'node_modules');
      if (!(await pathExists(nodeModulesPath))) {
        throw new Error(
          `Plugin ${entry.slug} is configured to vendor node_modules, but ${nodeModulesPath} is missing`,
        );
      }
      await fs.cp(nodeModulesPath, path.join(stagingDir, 'node_modules'), {
        recursive: true,
        force: true,
      });
    }

    if (await pathExists(path.join(stagingDir, 'package.json'))) {
      await installPluginProductionDependencies(stagingDir);
    }

    if (await pathExists(path.join(stagingDir, 'prisma', 'schema.prisma'))) {
      await generateStagedPluginPrismaClient(stagingDir);
    }

    await pruneExecutablePackageArtifacts(stagingDir);
    await writeChecksumsJson(stagingDir);
    return gatherFiles(stagingDir);
  } finally {
    await preparedSource.cleanup();
  }
}

async function ensureThemePackPath(sourceDir: string, relativePath?: string): Promise<void> {
  if (!relativePath) {
    return;
  }

  const absolutePath = path.join(sourceDir, relativePath);
  if (!(await pathExists(absolutePath))) {
    throw new Error(`Theme Pack source is missing required path: ${relativePath}`);
  }
}

function getThemeRuntimeEntryCandidates(packageDir: string): string[] {
  return [
    path.join(packageDir, 'src', 'runtime.tsx'),
    path.join(packageDir, 'src', 'runtime.ts'),
    path.join(packageDir, 'runtime', 'index.tsx'),
    path.join(packageDir, 'runtime', 'index.ts'),
  ];
}

async function resolveThemeRuntimeEntry(packageDir: string, slug: string): Promise<string> {
  for (const candidate of getThemeRuntimeEntryCandidates(packageDir)) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Theme ${slug} declares a packaged runtime but no runtime entry file was found`);
}

function createThemeHostExternalPlugin(): esbuild.Plugin {
  return {
    name: 'theme-host-externals',
    setup(build) {
      build.onResolve({ filter: /^(react|react\/jsx-runtime|react\/jsx-dev-runtime|next\/image|next\/navigation|next-themes)$/ }, (args) => ({
        path: args.path,
        namespace: 'theme-host-external',
      }));

      build.onLoad({ filter: /.*/, namespace: 'theme-host-external' }, async (args) => {
        const contentsByModule: Record<string, string> = {
          react: `
            const ReactNS = window.__JIFFOO_THEME_HOST__.React;
            export default ReactNS;
            export const Children = ReactNS.Children;
            export const Component = ReactNS.Component;
            export const Fragment = ReactNS.Fragment;
            export const Profiler = ReactNS.Profiler;
            export const PureComponent = ReactNS.PureComponent;
            export const StrictMode = ReactNS.StrictMode;
            export const Suspense = ReactNS.Suspense;
            export const cloneElement = ReactNS.cloneElement;
            export const createContext = ReactNS.createContext;
            export const createElement = ReactNS.createElement;
            export const createRef = ReactNS.createRef;
            export const forwardRef = ReactNS.forwardRef;
            export const isValidElement = ReactNS.isValidElement;
            export const lazy = ReactNS.lazy;
            export const memo = ReactNS.memo;
            export const startTransition = ReactNS.startTransition;
            export const use = ReactNS.use;
            export const useActionState = ReactNS.useActionState;
            export const useCallback = ReactNS.useCallback;
            export const useContext = ReactNS.useContext;
            export const useDebugValue = ReactNS.useDebugValue;
            export const useDeferredValue = ReactNS.useDeferredValue;
            export const useEffect = ReactNS.useEffect;
            export const useId = ReactNS.useId;
            export const useImperativeHandle = ReactNS.useImperativeHandle;
            export const useInsertionEffect = ReactNS.useInsertionEffect;
            export const useLayoutEffect = ReactNS.useLayoutEffect;
            export const useMemo = ReactNS.useMemo;
            export const useOptimistic = ReactNS.useOptimistic;
            export const useReducer = ReactNS.useReducer;
            export const useRef = ReactNS.useRef;
            export const useState = ReactNS.useState;
            export const useSyncExternalStore = ReactNS.useSyncExternalStore;
            export const useTransition = ReactNS.useTransition;
          `,
          'react/jsx-runtime': `
            const Runtime = window.__JIFFOO_THEME_HOST__.jsxRuntime;
            export const Fragment = Runtime.Fragment;
            export const jsx = Runtime.jsx;
            export const jsxs = Runtime.jsxs;
          `,
          'react/jsx-dev-runtime': `
            const Runtime = window.__JIFFOO_THEME_HOST__.jsxRuntime;
            export const Fragment = Runtime.Fragment;
            export const jsxDEV = Runtime.jsxDEV;
          `,
          'next/image': `
            const Image = window.__JIFFOO_THEME_HOST__.nextImage;
            export default Image;
          `,
          'next/navigation': `
            const Navigation = window.__JIFFOO_THEME_HOST__.nextNavigation;
            export const useParams = Navigation.useParams;
            export const usePathname = Navigation.usePathname;
            export const useRouter = Navigation.useRouter;
            export const useSearchParams = Navigation.useSearchParams;
          `,
          'next-themes': `
            const NextThemes = window.__JIFFOO_THEME_HOST__.nextThemes;
            export const ThemeProvider = NextThemes.ThemeProvider;
            export const useTheme = NextThemes.useTheme;
          `,
        };

        const contents = contentsByModule[args.path];
        if (!contents) {
          throw new Error(`No host external shim configured for ${args.path}`);
        }

        return {
          contents,
          loader: 'js',
        };
      });
    },
  };
}

async function buildThemeRuntimeBundle(
  entry: OfficialCatalogEntry,
  packageDir: string,
  stagingDir: string,
  manifest: ThemePackSourceManifest,
): Promise<string | null> {
  const runtimePath = manifest.entry?.runtimeJS;
  if (!runtimePath) {
    return null;
  }

  const runtimeEntry = await resolveThemeRuntimeEntry(packageDir, entry.slug);
  const runtimeOutputPath = path.join(stagingDir, runtimePath);
  await ensureDir(path.dirname(runtimeOutputPath));

  await esbuild.build({
    stdin: {
      contents: `
        import theme from ${JSON.stringify(runtimeEntry)};
        window.__JIFFOO_THEME_RUNTIME__ = theme;
      `,
      resolveDir: REPO_ROOT,
      sourcefile: `${entry.slug}-theme-runtime-entry.ts`,
      loader: 'ts',
    },
    outfile: runtimeOutputPath,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    plugins: [createThemeHostExternalPlugin()],
  });

  return runtimePath;
}

async function stageThemeArtifact(entry: OfficialCatalogEntry, stagingDir: string): Promise<string[]> {
  const packageDir = path.join(REPO_ROOT, 'packages', 'shop-themes', entry.slug);
  const sourceDir = path.join(packageDir, 'theme-pack');
  const themeManifestPath = path.join(sourceDir, 'theme.json');
  const packageRootJsonPath = path.join(packageDir, 'package.json');
  const packageRootReadmePath = path.join(packageDir, 'README.md');

  if (!(await pathExists(sourceDir))) {
    throw new Error(`Theme Pack source directory not found for ${entry.slug}: ${sourceDir}`);
  }

  if (!(await pathExists(themeManifestPath))) {
    throw new Error(`Theme Pack manifest not found for ${entry.slug}: ${themeManifestPath}`);
  }

  const packageJson = JSON.parse(await fs.readFile(packageRootJsonPath, 'utf-8')) as {
    version?: string;
  };
  const manifest = JSON.parse(await fs.readFile(themeManifestPath, 'utf-8')) as ThemePackSourceManifest;

  if (packageJson.version && packageJson.version !== entry.version) {
    throw new Error(
      `Theme ${entry.slug} package.json version ${packageJson.version} does not match official catalog version ${entry.version}`,
    );
  }

  if (manifest.slug !== entry.slug) {
    throw new Error(`Theme Pack manifest slug ${manifest.slug} does not match official catalog slug ${entry.slug}`);
  }

  if (manifest.schemaVersion !== 1) {
    throw new Error(`Theme Pack manifest schemaVersion ${manifest.schemaVersion} is not supported for ${entry.slug}`);
  }

  if (manifest.name !== entry.name) {
    throw new Error(`Theme Pack manifest name ${manifest.name} does not match official catalog name ${entry.name}`);
  }

  if (manifest.version !== entry.version) {
    throw new Error(
      `Theme Pack manifest version ${manifest.version} does not match official catalog version ${entry.version}`,
    );
  }

  if (manifest.target !== 'shop') {
    throw new Error(`Theme Pack manifest target ${manifest.target} is not supported for official shop theme ${entry.slug}`);
  }

  if (manifest.compatibility?.minCoreVersion && manifest.compatibility.minCoreVersion !== entry.minCoreVersion) {
    throw new Error(
      `Theme Pack manifest minCoreVersion ${manifest.compatibility.minCoreVersion} does not match official catalog version ${entry.minCoreVersion}`,
    );
  }

  if (manifest.entry?.runtimeJS) {
    if (manifest['x-jiffoo-renderer-mode'] !== 'embedded') {
      throw new Error(`Theme Pack manifest for ${entry.slug} must declare x-jiffoo-renderer-mode=embedded`);
    }

    if (manifest['x-jiffoo-renderer-slug'] !== entry.slug) {
      throw new Error(
        `Theme Pack manifest renderer slug ${manifest['x-jiffoo-renderer-slug']} does not match official theme slug ${entry.slug}`,
      );
    }
  }

  await ensureThemePackPath(sourceDir, manifest.entry?.tokensCSS || 'tokens.css');
  await ensureThemePackPath(sourceDir, manifest.entry?.templatesDir || 'templates');
  await ensureThemePackPath(sourceDir, manifest.entry?.assetsDir);
  await ensureThemePackPath(sourceDir, manifest.entry?.settingsSchema);
  await ensureThemePackPath(sourceDir, manifest.entry?.presetsDir);

  await fs.cp(sourceDir, stagingDir, { recursive: true, force: true });
  await buildThemeRuntimeBundle(entry, packageDir, stagingDir, manifest);
  await copyIfExists(packageRootReadmePath, path.join(stagingDir, 'README.md'));
  await copyIfExists(ROOT_LICENSE_PATH, path.join(stagingDir, 'LICENSE'));

  await writeChecksumsJson(stagingDir);
  return gatherFiles(stagingDir);
}

async function buildSingleArtifact(
  entry: OfficialCatalogEntry,
  outputDir: string,
  artifactBaseUrl?: string,
): Promise<BuiltArtifactSummary> {
  const kind = toOfficialArtifactKind(entry);
  const version = entry.version;
  const extension = kind === 'theme' ? 'jtheme' : 'jplugin';
  const kindDir = kind === 'theme' ? 'themes' : 'plugins';
  const relativePath = `${kindDir}/${entry.slug}/${version}.${extension}`;
  const outputFilePath = path.join(outputDir, relativePath);
  const sourceDir = path.join(
    REPO_ROOT,
    kind === 'theme'
      ? path.join('packages', 'shop-themes', entry.slug, 'theme-pack')
      : path.join('extensions', 'plugins', entry.slug),
  );

  const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), `official-artifact-${entry.slug}-`));

  try {
    const includedFiles =
      kind === 'theme'
        ? await stageThemeArtifact(entry, stagingDir)
        : await stagePluginArtifact(entry, stagingDir);

    await createZipArchive(stagingDir, outputFilePath);
    const sidecars = await writeArtifactSidecars(outputFilePath);

    return {
      slug: entry.slug,
      kind,
      version,
      packageUrl: getDefaultPackageUrl(entry, artifactBaseUrl),
      filePath: outputFilePath,
      relativePath,
      sha256: sidecars.sha256,
      sizeBytes: sidecars.sizeBytes,
      sourceDir,
      includedFiles,
      ...(sidecars.signaturePath ? { signaturePath: sidecars.signaturePath } : {}),
    };
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true });
  }
}

export async function buildOfficialArtifacts(
  options: BuildOfficialArtifactsOptions = {},
): Promise<BuildOfficialArtifactsResult> {
  const outputDir = path.resolve(options.outputDir || DEFAULT_OUTPUT_DIR);
  const slugSet = new Set(options.slugs || []);
  const kindSet = new Set(options.kinds || []);

  const selectedEntries = OFFICIAL_LAUNCH_EXTENSIONS.filter((entry) => {
    if (entry.deliveryMode !== 'package-managed') {
      return false;
    }

    if (slugSet.size > 0 && !slugSet.has(entry.slug)) {
      return false;
    }

    if (kindSet.size > 0 && !kindSet.has(toOfficialArtifactKind(entry))) {
      return false;
    }

    return true;
  });

  if (selectedEntries.length === 0) {
    throw new Error('No official extensions matched the requested build filters');
  }

  await fs.rm(outputDir, { recursive: true, force: true });
  await ensureDir(outputDir);

  const items: BuiltArtifactSummary[] = [];
  for (const entry of selectedEntries) {
    items.push(await buildSingleArtifact(entry, outputDir, options.artifactBaseUrl));
  }

  const result: BuildOfficialArtifactsResult = {
    generatedAt: new Date().toISOString(),
    outputDir,
    items,
  };

  await fs.writeFile(
    path.join(outputDir, 'index.json'),
    JSON.stringify(result, null, 2),
    'utf-8',
  );

  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await buildOfficialArtifacts(options);

  console.log(`Built ${result.items.length} official artifacts into ${result.outputDir}`);
  for (const item of result.items) {
    console.log(
      `- ${item.kind} ${item.slug}@${item.version} -> ${item.relativePath} (${item.sizeBytes} bytes, sha256=${item.sha256})`,
    );
  }
}

// Use pathToFileURL for Windows-compatible comparison (handles spaces in paths)
import { pathToFileURL } from 'url';
const _currentUrl = import.meta.url;
const _argvUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (_currentUrl === _argvUrl) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

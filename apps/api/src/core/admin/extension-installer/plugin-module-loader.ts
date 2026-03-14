import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

const runtimeRequire = createRequire(__filename);
const nativeDynamicImport = new Function('specifier', 'return import(specifier);') as (
  specifier: string,
) => Promise<any>;

function findNearestPackageJson(startDir: string): string | null {
  let currentDir = startDir;

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      return packageJsonPath;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

function isEsmModule(entryPath: string): boolean {
  const extension = path.extname(entryPath).toLowerCase();
  if (extension === '.mjs' || extension === '.mts') {
    return true;
  }
  if (extension === '.cjs' || extension === '.cts') {
    return false;
  }

  const packageJsonPath = findNearestPackageJson(path.dirname(entryPath));
  if (!packageJsonPath) {
    return false;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { type?: string };
    return packageJson.type === 'module';
  } catch {
    return false;
  }
}

export async function loadPluginEntryModule(
  entryPath: string,
  options?: { version?: string; bustCache?: boolean },
): Promise<any> {
  const absolutePath = path.resolve(entryPath);

  if (isEsmModule(absolutePath)) {
    const specifier = pathToFileURL(absolutePath).href;
    if (options?.bustCache === false) {
      return nativeDynamicImport(specifier);
    }

    const version = options?.version || '0';
    return nativeDynamicImport(`${specifier}?v=${version}&t=${Date.now()}`);
  }

  const resolvedPath = runtimeRequire.resolve(absolutePath);
  if (options?.bustCache !== false) {
    delete runtimeRequire.cache[resolvedPath];
  }

  return runtimeRequire(resolvedPath);
}

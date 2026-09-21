import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { createRequire } from 'module';

const runtimeRequire = createRequire(__filename);
const ESM_PLUGIN_ERROR = 'ESM plugin packages are not supported in Core V1; the entry module must be CommonJS.';

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

function assertCommonJsModule(entryPath: string): void {
  const extension = path.extname(entryPath).toLowerCase();
  if (extension === '.mjs' || extension === '.mts') {
    throw new Error(ESM_PLUGIN_ERROR);
  }
  if (extension === '.cjs' || extension === '.cts') {
    return;
  }

  const packageJsonPath = findNearestPackageJson(path.dirname(entryPath));
  if (!packageJsonPath) {
    return;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { type?: string };
    if (packageJson.type === 'module') throw new Error(ESM_PLUGIN_ERROR);
  } catch {
    return;
  }
}

export async function loadPluginEntryModule(
  entryPath: string,
  options?: { version?: string; bustCache?: boolean },
): Promise<any> {
  const absolutePath = path.resolve(entryPath);

  assertCommonJsModule(absolutePath);

  const resolvedPath = runtimeRequire.resolve(absolutePath);
  if (options?.bustCache !== false) {
    delete runtimeRequire.cache[resolvedPath];
  }

  return runtimeRequire(resolvedPath);
}

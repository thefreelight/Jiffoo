import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { assertNoLegacyPluginMigrations } from './contract-v1-runtime';
import { PluginGatewayError } from '@/core/extensions/runtime/contract-errors';

const runtimeRequire = createRequire(__filename);
const ESM_PLUGIN_ERROR = 'ESM plugin packages are not supported in Core V1; the entry module must be CommonJS.';

/**
 * Budget of a plugin entry module load.
 *
 * The load runs inside the Core process, so a module whose top level blocks
 * holds the Core event loop. The budget cannot preempt the load, but it turns
 * an abnormally slow module into a failure of that plugin instead of a plugin
 * that is used forever.
 */
export const PLUGIN_MODULE_LOAD_TIMEOUT_MS = 5000;

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

  let packageJson: { type?: string };
  try {
    packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { type?: string };
  } catch {
    return;
  }
  if (packageJson.type === 'module') throw new Error(ESM_PLUGIN_ERROR);
}

export async function loadPluginEntryModule(
  entryPath: string,
  options?: { version?: string; bustCache?: boolean },
): Promise<any> {
  assertCommonJsModule(entryPath);

  const resolvedPath = runtimeRequire.resolve(entryPath);
  if (options?.bustCache !== false) {
    delete runtimeRequire.cache[resolvedPath];
  }

  const startedAt = Date.now();
  const entry = runtimeRequire(resolvedPath);
  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs > PLUGIN_MODULE_LOAD_TIMEOUT_MS) {
    throw new PluginGatewayError(
      `Plugin entry module load exceeded ${PLUGIN_MODULE_LOAD_TIMEOUT_MS}ms`,
      'PLUGIN_LOAD_FAILED',
      400,
    );
  }
  assertNoLegacyPluginMigrations(entry);
  assertNoLegacyPluginMigrations(entry?.default);
  return entry;
}

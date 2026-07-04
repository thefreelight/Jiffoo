import fs from 'fs';
import path from 'path';

export interface RuntimeBuildInfo {
  appVersion: string;
  packageVersion: string;
  gitSha: string;
  buildTime: string;
}

function readJson(filePath: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function findWorkspacePackageJson(startDir: string): string | null {
  let current = startDir;
  let fallback: string | null = null;

  for (;;) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      const parsed = readJson(candidate);
      if (parsed && Array.isArray(parsed.workspaces)) {
        return candidate;
      }
      fallback = fallback || candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return fallback;
    }
    current = parent;
  }
}

function resolvePackageVersion(): string {
  const explicitPackageJson = process.env.JIFFOO_ROOT_PACKAGE_JSON;
  const packageJsonPath = explicitPackageJson && explicitPackageJson.trim().length > 0
    ? explicitPackageJson.trim()
    : findWorkspacePackageJson(process.cwd());

  if (!packageJsonPath) {
    return process.env.APP_VERSION || '1.0.0';
  }

  const parsed = readJson(packageJsonPath);
  return typeof parsed?.version === 'string' && parsed.version.trim().length > 0
    ? parsed.version.trim()
    : process.env.APP_VERSION || '1.0.0';
}

export function getRuntimeBuildInfo(): RuntimeBuildInfo {
  return {
    appVersion: process.env.APP_VERSION || '1.0.0',
    packageVersion: resolvePackageVersion(),
    gitSha: process.env.BUILD_SHA || 'development',
    buildTime: process.env.BUILD_TIME || new Date().toISOString(),
  };
}

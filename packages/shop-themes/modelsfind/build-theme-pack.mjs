#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildThemeRuntimeBundle } from './build-theme-runtime.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  outputName: 'modelsfind-theme-pack.zip',
  themePackDir: path.join(__dirname, 'theme-pack'),
};

function log(step, message) {
  console.log(`[${step}] ${message}`);
}

function assertExists(relPath, kind) {
  const abs = path.join(config.themePackDir, relPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`${kind} missing: ${relPath}`);
  }
}

function ensureManifestMatches() {
  const manifestPath = path.join(config.themePackDir, 'theme.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (manifest.schemaVersion !== 1) {
    throw new Error('theme.json schemaVersion must be 1');
  }
  if (manifest.target !== 'shop') {
    throw new Error('theme.json target must be "shop"');
  }
  if (typeof manifest.slug !== 'string' || !manifest.slug) {
    throw new Error('theme.json slug is required');
  }
  if (typeof manifest.version !== 'string' || !manifest.version) {
    throw new Error('theme.json version is required');
  }

  return manifest;
}

function removeIfExists(absPath) {
  if (fs.existsSync(absPath)) {
    fs.rmSync(absPath, { recursive: true, force: true });
  }
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function createZip(distDir, zipPath) {
  if (process.platform === 'win32') {
    execSync(
      `powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force"`,
      { stdio: 'inherit' }
    );
    return;
  }

  execSync(`cd "${distDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
}

function collectRequiredPaths(manifest) {
  const requiredFiles = ['theme.json'];
  const requiredDirs = [];
  const includePaths = ['theme.json'];

  const tokensCSS = manifest?.entry?.tokensCSS || 'tokens.css';
  requiredFiles.push(tokensCSS);
  includePaths.push(tokensCSS);

  const runtimeJS = manifest?.entry?.runtimeJS;
  if (runtimeJS) {
    requiredFiles.push(runtimeJS);
    includePaths.push(runtimeJS);
  }

  const templatesDir = manifest?.entry?.templatesDir || 'templates';
  requiredDirs.push(templatesDir);
  includePaths.push(templatesDir);

  if (manifest?.entry?.schemasDir) {
    requiredDirs.push(manifest.entry.schemasDir);
    includePaths.push(manifest.entry.schemasDir);
  } else if (manifest?.entry?.settingsSchema) {
    requiredFiles.push(manifest.entry.settingsSchema);
    includePaths.push(manifest.entry.settingsSchema);
  } else {
    requiredDirs.push('schemas');
    includePaths.push('schemas');
  }

  if (manifest?.entry?.assetsDir) {
    requiredDirs.push(manifest.entry.assetsDir);
    includePaths.push(manifest.entry.assetsDir);
  }

  if (manifest?.entry?.presetsDir) {
    requiredDirs.push(manifest.entry.presetsDir);
    includePaths.push(manifest.entry.presetsDir);
  }

  return {
    requiredFiles: Array.from(new Set(requiredFiles)),
    requiredDirs: Array.from(new Set(requiredDirs)),
    includePaths: Array.from(new Set(includePaths)),
  };
}

async function main() {
  const manifest = ensureManifestMatches();
  const manifestInfo = { slug: manifest.slug, version: manifest.version };

  log('1', 'Building storefront runtime bundle');
  await buildThemeRuntimeBundle();

  const { requiredFiles, requiredDirs, includePaths } = collectRequiredPaths(manifest);

  log('2', 'Validating theme pack files');
  requiredFiles.forEach((f) => assertExists(f, 'required file'));
  requiredDirs.forEach((d) => assertExists(d, 'required directory'));

  const distDir = path.join(__dirname, 'dist-theme-pack');
  const zipPath = path.join(__dirname, config.outputName);

  log('3', 'Preparing dist directory');
  removeIfExists(distDir);
  fs.mkdirSync(distDir, { recursive: true });

  log('4', 'Copying installable files only');
  for (const rel of includePaths) {
    copyRecursive(path.join(config.themePackDir, rel), path.join(distDir, rel));
  }

  log('5', 'Creating zip archive');
  removeIfExists(zipPath);
  createZip(distDir, zipPath);

  const stat = fs.statSync(zipPath);
  log(
    '6',
    `Done: ${zipPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB) for ${manifestInfo.slug}@${manifestInfo.version}`
  );
}

try {
  await main();
} catch (error) {
  console.error(`Build failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

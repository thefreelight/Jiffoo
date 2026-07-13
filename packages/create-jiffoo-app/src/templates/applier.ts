/**
 * Template Applier
 *
 * Applies a template's configuration to a freshly cloned project:
 * 1. Merges env presets into .env
 * 2. Writes a template manifest for the project to reference
 * 3. Copies seed data into the project's seed directory
 */

import fs from 'fs-extra';
import path from 'node:path';
import type { TemplateConfig } from './registry.js';

// Static imports ensure seed data is bundled with the CLI
// (resolveJsonModule: true in tsconfig.json enables this)
import digitalGoodsSeed from './seed-data/digital-goods.json';
import esimSeed from './seed-data/esim.json';

// ---------------------------------------------------------------------------
// Seed Data Registry
// ---------------------------------------------------------------------------

const SEED_DATA: Record<string, unknown> = {
  'digital-goods': digitalGoodsSeed,
  esim: esimSeed,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApplyResult {
  /** Path to the project directory */
  projectDir: string;
  /** Template that was applied */
  template: TemplateConfig;
  /** Env keys that were written */
  envKeysWritten: string[];
  /** Path to the template manifest file (if written) */
  manifestPath: string | null;
  /** Path to the seed data file (if copied) */
  seedDataPath: string | null;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Apply a template's configuration to a project directory.
 *
 * This is called AFTER the repository has been cloned, so the .env file
 * already exists (copied from .env.example by setupEnvironment()).
 */
export async function applyTemplate(
  projectDir: string,
  template: TemplateConfig,
): Promise<ApplyResult> {
  const envKeysWritten: string[] = [];

  // 1. Merge env presets into .env
  if (Object.keys(template.envPresets).length > 0) {
    await mergeEnvPresets(projectDir, template.envPresets);
    envKeysWritten.push(...Object.keys(template.envPresets));
  }

  // 2. Write template manifest for project reference
  const manifestPath = await writeTemplateManifest(projectDir, template);

  // 3. Copy seed data file if available for this template
  let seedDataPath: string | null = null;
  const seedData = SEED_DATA[template.seedDataset.id];

  if (seedData) {
    const destDir = path.join(projectDir, 'apps', 'api', 'prisma', 'seed-data');
    await fs.ensureDir(destDir);
    const destFile = path.join(destDir, `${template.seedDataset.id}.json`);
    await fs.writeJson(destFile, seedData, { spaces: 2 });
    seedDataPath = destFile;
  }

  return {
    projectDir,
    template,
    envKeysWritten,
    manifestPath,
    seedDataPath,
  };
}

/**
 * Merge environment variable presets into an existing .env file.
 *
 * - If a key already exists, it is overwritten with the template value.
 * - If a key doesn't exist, it is appended.
 * - A comment block is added to indicate which template set these values.
 */
async function mergeEnvPresets(
  projectDir: string,
  presets: Record<string, string>,
): Promise<void> {
  const envFile = path.join(projectDir, '.env');

  if (!(await fs.pathExists(envFile))) {
    // No .env file yet — create one with presets
    const lines = [
      '# ============================================',
      '# Template Presets',
      '# ============================================',
      '',
      ...Object.entries(presets).map(([key, value]) => `${key}="${value}"`),
      '',
    ];
    await fs.writeFile(envFile, lines.join('\n'));
    return;
  }

  let content = await fs.readFile(envFile, 'utf-8');
  const lines = content.split('\n');

  // Track which keys we've already set
  const setKeys = new Set<string>();

  // Update existing keys
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (match) {
      const key = match[1];
      if (key in presets) {
        lines[i] = `${key}="${presets[key]}"`;
        setKeys.add(key);
      }
    }
  }

  // Append keys that weren't found
  const newKeys = Object.keys(presets).filter((k) => !setKeys.has(k));
  if (newKeys.length > 0) {
    lines.push('');
    lines.push('# ============================================');
    lines.push('# Template Presets');
    lines.push('# ============================================');
    for (const key of newKeys) {
      lines.push(`${key}="${presets[key]}"`);
    }
  }

  content = lines.join('\n');
  await fs.writeFile(envFile, content);
}

/**
 * Write a .jiffoo-template.json manifest in the project root.
 *
 * This file records which template was used to create the project,
 * so that subsequent tooling (e.g. theme management) can reference it.
 */
async function writeTemplateManifest(
  projectDir: string,
  template: TemplateConfig,
): Promise<string> {
  const manifestPath = path.join(projectDir, '.jiffoo-template.json');
  const manifest = {
    template: template.name,
    displayName: template.displayName,
    category: template.category,
    theme: {
      slug: template.theme.slug,
      packageName: template.theme.packageName,
      version: template.theme.version,
      source: template.theme.source,
    },
    seedDataset: {
      id: template.seedDataset.id,
      profile: template.seedDataset.profile,
    },
    createdAt: new Date().toISOString(),
  };

  await fs.writeJson(manifestPath, manifest, { spaces: 2 });
  return manifestPath;
}

/**
 * Pack Command - Package plugin for submission to marketplace
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import crypto from 'crypto';
import archiver from 'archiver';
import { buildCommand } from './build';
import { validateCommand } from './validate';

interface PackOptions {
  output?: string;
  includeSource?: boolean;
  build?: boolean;
  validate?: boolean;
}

export async function packCommand(options: PackOptions) {
  console.log(chalk.blue('\nJiffoo Plugin SDK - Package\n'));

  const cwd = process.cwd();
  const manifestPath = path.join(cwd, 'manifest.json');
  const distDir = path.join(cwd, 'dist');

  if (!await fs.pathExists(manifestPath)) {
    console.log(chalk.red('Error: manifest.json not found. Are you in a plugin directory?'));
    process.exit(1);
  }

  // One-click flow by default: validate + build + package
  if (options.validate !== false) {
    await validateCommand({ manifest: 'manifest.json', strict: false });
  }
  if (options.build !== false) {
    await buildCommand({ output: 'dist', minify: true });
  }

  const manifest = await fs.readJson(manifestPath);
  const outputFileName = options.output || `${manifest.slug}-${manifest.version}.zip`;
  const outputPath = path.join(cwd, outputFileName);

  console.log(chalk.cyan(`Packaging: ${manifest.name} v${manifest.version}`));
  console.log(chalk.cyan(`Output: ${outputFileName}`));
  console.log('');

  const spinner = ora('Packaging plugin...').start();

  try {
    const hasDist = await fs.pathExists(distDir);
    const runtimeType = manifest.runtimeType as string | undefined;
    let codePathLabel = 'dist/';

    const tempDir = path.join(cwd, '.pack-temp');
    await fs.remove(tempDir);
    await fs.ensureDir(tempDir);

    spinner.text = 'Copying files...';

    await fs.copy(manifestPath, path.join(tempDir, 'manifest.json'));

    if (hasDist) {
      await fs.copy(distDir, path.join(tempDir, 'dist'));
      codePathLabel = 'dist/';
    } else if (options.includeSource) {
      await fs.copy(path.join(cwd, 'src'), path.join(tempDir, 'src'));
      codePathLabel = 'src/';
    } else if (runtimeType === 'external-http') {
      // external-http plugins can be metadata-only for installation
      codePathLabel = '(none, external-http metadata-only)';
    } else {
      spinner.fail(chalk.red('No dist directory found. Run "npm run build" first.'));
      await fs.remove(tempDir);
      process.exit(1);
    }

    const packageJson = await fs.readJson(path.join(cwd, 'package.json'));
    const prodPackageJson = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      ...(hasDist || options.includeSource ? { main: packageJson.main } : {}),
      dependencies: packageJson.dependencies,
      license: packageJson.license,
    };
    await fs.writeJson(path.join(tempDir, 'package.json'), prodPackageJson, { spaces: 2 });

    const licensePath = path.join(cwd, 'LICENSE');
    if (await fs.pathExists(licensePath)) {
      await fs.copy(licensePath, path.join(tempDir, 'LICENSE'));
    } else {
      spinner.fail(chalk.red('LICENSE file is required for marketplace submission.'));
      await fs.remove(tempDir);
      process.exit(1);
    }

    const readmePath = path.join(cwd, 'README.md');
    if (await fs.pathExists(readmePath)) {
      await fs.copy(readmePath, path.join(tempDir, 'README.md'));
    }

    spinner.text = 'Generating checksums...';
    const checksums = await generateChecksums(tempDir);
    await fs.writeJson(path.join(tempDir, 'checksums.json'), checksums, { spaces: 2 });

    spinner.text = 'Creating zip archive...';
    if (await fs.pathExists(outputPath)) {
      await fs.remove(outputPath);
    }
    await createZipArchive(tempDir, outputPath);

    await fs.remove(tempDir);

    const stat = await fs.stat(outputPath);
    const sizeStr = formatBytes(stat.size);
    const packageHash = await calculateFileHash(outputPath);

    spinner.succeed(chalk.green(`Package created successfully (${sizeStr})`));

    console.log(`
${chalk.cyan('Package details:')}
  ${chalk.yellow('File:')}     ${outputFileName}
  ${chalk.yellow('Size:')}     ${sizeStr}
  ${chalk.yellow('SHA256:')}   ${packageHash}

${chalk.cyan('Package contents:')}
  - manifest.json
  - package.json
  - LICENSE
  - README.md
  - ${codePathLabel}
  - checksums.json

${chalk.cyan('Next steps:')}
  1. Open your Admin extensions page
  2. Upload ${chalk.yellow(outputFileName)} via plugin ZIP install
  3. Enable plugin and configure instance values
`);
  } catch (error) {
    spinner.fail(chalk.red('Packaging failed'));
    console.error(error);
    process.exit(1);
  }
}

async function generateChecksums(dir: string): Promise<Record<string, string>> {
  const checksums: Record<string, string> = {};

  async function processDir(currentDir: string, prefix = '') {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await processDir(fullPath, relativePath);
      } else {
        checksums[relativePath] = await calculateFileHash(fullPath);
      }
    }
  }

  await processDir(dir);
  return checksums;
}

async function calculateFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function createZipArchive(sourceDir: string, outputFilePath: string): Promise<void> {
  await fs.ensureDir(path.dirname(outputFilePath));
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(outputFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

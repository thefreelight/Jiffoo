/**
 * Pack Command - Package theme for submission to marketplace
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import crypto from 'crypto';

interface PackOptions {
  output?: string;
  includeSource: boolean;
}

export async function packCommand(options: PackOptions) {
  console.log(chalk.blue('\n📦 Jiffoo Theme SDK - Package\n'));

  const cwd = process.cwd();
  const manifestPath = path.join(cwd, 'manifest.json');
  const distDir = path.join(cwd, 'dist');

  // Check if manifest exists
  if (!await fs.pathExists(manifestPath)) {
    console.log(chalk.red('Error: manifest.json not found. Are you in a theme directory?'));
    process.exit(1);
  }

  const manifest = await fs.readJson(manifestPath);
  const outputFileName = options.output || `${manifest.slug}-${manifest.version}.zip`;
  const outputPath = path.join(cwd, outputFileName);

  console.log(chalk.cyan(`Packaging: ${manifest.name} v${manifest.version}`));
  console.log(chalk.cyan(`Output: ${outputFileName}`));
  console.log('');

  const spinner = ora('Packaging theme...').start();

  try {
    // Create temp directory for packaging
    const tempDir = path.join(cwd, '.pack-temp');
    await fs.remove(tempDir);
    await fs.ensureDir(tempDir);

    // Copy required files
    spinner.text = 'Copying files...';

    // Copy manifest
    await fs.copy(manifestPath, path.join(tempDir, 'manifest.json'));

    // Copy dist or src
    if (await fs.pathExists(distDir)) {
      await fs.copy(distDir, path.join(tempDir, 'dist'));
    } else if (options.includeSource) {
      await fs.copy(path.join(cwd, 'src'), path.join(tempDir, 'src'));
    } else {
      spinner.fail(chalk.red('No dist directory found. Run "npm run build" first.'));
      await fs.remove(tempDir);
      process.exit(1);
    }

    // Copy styles
    const stylesDir = path.join(cwd, 'src', 'styles');
    if (await fs.pathExists(stylesDir)) {
      await fs.copy(stylesDir, path.join(tempDir, 'styles'));
    }

    // Copy public assets
    const publicDir = path.join(cwd, 'public');
    if (await fs.pathExists(publicDir)) {
      await fs.copy(publicDir, path.join(tempDir, 'public'));
    }

    // Copy package.json (production version)
    const packageJson = await fs.readJson(path.join(cwd, 'package.json'));
    const prodPackageJson = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      main: packageJson.main,
      peerDependencies: packageJson.peerDependencies,
      license: packageJson.license,
    };
    await fs.writeJson(path.join(tempDir, 'package.json'), prodPackageJson, { spaces: 2 });

    // Copy LICENSE
    const licensePath = path.join(cwd, 'LICENSE');
    if (await fs.pathExists(licensePath)) {
      await fs.copy(licensePath, path.join(tempDir, 'LICENSE'));
    } else {
      spinner.fail(chalk.red('LICENSE file is required for marketplace submission.'));
      await fs.remove(tempDir);
      process.exit(1);
    }

    // Copy README
    const readmePath = path.join(cwd, 'README.md');
    if (await fs.pathExists(readmePath)) {
      await fs.copy(readmePath, path.join(tempDir, 'README.md'));
    }

    // Generate checksum file
    spinner.text = 'Generating checksums...';
    const checksums = await generateChecksums(tempDir);
    await fs.writeJson(path.join(tempDir, 'checksums.json'), checksums, { spaces: 2 });

    // Create zip archive
    spinner.text = 'Creating archive...';
    
    // Remove existing output file
    if (await fs.pathExists(outputPath)) {
      await fs.remove(outputPath);
    }

    // Use system zip command
    try {
      execSync(`cd "${tempDir}" && zip -r "${outputPath}" .`, { stdio: 'pipe' });
    } catch {
      // Fallback: try using tar if zip is not available
      try {
        execSync(`cd "${tempDir}" && tar -czf "${outputPath.replace('.zip', '.tar.gz')}" .`, { stdio: 'pipe' });
        console.log(chalk.yellow('\nNote: Created .tar.gz instead of .zip (zip not available)'));
      } catch {
        spinner.fail(chalk.red('Failed to create archive. Please install zip or tar.'));
        await fs.remove(tempDir);
        process.exit(1);
      }
    }

    // Clean up temp directory
    await fs.remove(tempDir);

    // Get package size
    const stat = await fs.stat(outputPath);
    const sizeStr = formatBytes(stat.size);

    // Calculate package hash
    const packageHash = await calculateFileHash(outputPath);

    spinner.succeed(chalk.green(`Package created successfully (${sizeStr})`));

    console.log(`
${chalk.cyan('Package details:')}
  ${chalk.yellow('File:')}     ${outputFileName}
  ${chalk.yellow('Size:')}     ${sizeStr}
  ${chalk.yellow('SHA256:')}   ${packageHash}

${chalk.cyan('Next steps:')}
  1. Go to ${chalk.blue('https://developer.jiffoo.com')}
  2. Navigate to "Submit Theme"
  3. Upload ${chalk.yellow(outputFileName)}
  4. Add screenshots and description
  5. Submit for review

${chalk.gray('The review process typically takes 1-3 business days.')}
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

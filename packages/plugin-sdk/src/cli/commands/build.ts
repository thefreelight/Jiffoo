/**
 * Build Command - Build plugin for production
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';

interface BuildOptions {
  output: string;
  minify: boolean;
}

export async function buildCommand(options: BuildOptions) {
  console.log(chalk.blue('\n📦 Jiffoo Plugin SDK - Build\n'));

  const cwd = process.cwd();
  const manifestPath = path.join(cwd, 'manifest.json');
  const packagePath = path.join(cwd, 'package.json');
  const outputDir = path.join(cwd, options.output);

  // Check if we're in a plugin directory
  if (!await fs.pathExists(manifestPath)) {
    console.log(chalk.red('Error: manifest.json not found. Are you in a plugin directory?'));
    process.exit(1);
  }

  const manifest = await fs.readJson(manifestPath);
  console.log(chalk.cyan(`Building: ${manifest.name} v${manifest.version}`));
  console.log(chalk.cyan(`Output: ${options.output}/`));
  console.log('');

  const spinner = ora('Building plugin...').start();

  try {
    // Clean output directory
    await fs.remove(outputDir);
    await fs.ensureDir(outputDir);

    // Check if TypeScript
    const isTypeScript = await fs.pathExists(path.join(cwd, 'tsconfig.json'));

    if (isTypeScript) {
      spinner.text = 'Compiling TypeScript...';
      execSync('npx tsc', { cwd, stdio: 'pipe' });
    } else {
      // Copy JavaScript files
      spinner.text = 'Copying source files...';
      await fs.copy(path.join(cwd, 'src'), path.join(outputDir, 'src'));
    }

    // Copy manifest
    spinner.text = 'Copying manifest...';
    await fs.copy(manifestPath, path.join(outputDir, 'manifest.json'));

    // Copy package.json (production version)
    spinner.text = 'Creating production package.json...';
    const packageJson = await fs.readJson(packagePath);
    const prodPackageJson = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      main: isTypeScript ? 'index.js' : 'src/index.js',
      dependencies: packageJson.dependencies,
      license: packageJson.license,
    };
    await fs.writeJson(path.join(outputDir, 'package.json'), prodPackageJson, { spaces: 2 });

    // Copy LICENSE if exists
    const licensePath = path.join(cwd, 'LICENSE');
    if (await fs.pathExists(licensePath)) {
      await fs.copy(licensePath, path.join(outputDir, 'LICENSE'));
    }

    // Copy README if exists
    const readmePath = path.join(cwd, 'README.md');
    if (await fs.pathExists(readmePath)) {
      await fs.copy(readmePath, path.join(outputDir, 'README.md'));
    }

    // Calculate build size
    const buildSize = await getDirectorySize(outputDir);
    const sizeStr = formatBytes(buildSize);

    spinner.succeed(chalk.green(`Build completed successfully (${sizeStr})`));

    console.log(`
${chalk.cyan('Build output:')} ${outputDir}

${chalk.cyan('Files:')}
${await listBuildFiles(outputDir)}

${chalk.cyan('Next steps:')}
  ${chalk.yellow('npm run validate')}  Validate the build
  ${chalk.yellow('npm run pack')}      Package for submission
`);

  } catch (error) {
    spinner.fail(chalk.red('Build failed'));
    console.error(error);
    process.exit(1);
  }
}

async function getDirectorySize(dir: string): Promise<number> {
  let size = 0;
  const files = await fs.readdir(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isDirectory()) {
      size += await getDirectorySize(filePath);
    } else {
      size += stat.size;
    }
  }
  
  return size;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function listBuildFiles(dir: string, prefix = ''): Promise<string> {
  const files = await fs.readdir(dir);
  let output = '';
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isDirectory()) {
      output += `  ${prefix}${chalk.blue(file + '/')}\n`;
      output += await listBuildFiles(filePath, prefix + '  ');
    } else {
      const size = formatBytes(stat.size);
      output += `  ${prefix}${file} ${chalk.gray(`(${size})`)}\n`;
    }
  }
  
  return output;
}

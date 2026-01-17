/**
 * Validate Command - Validate plugin manifest and structure
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { validateManifest, ValidationResult } from '../../validators';

interface ValidateOptions {
  manifest: string;
  strict: boolean;
}

export async function validateCommand(options: ValidateOptions) {
  console.log(chalk.blue('\n✅ Jiffoo Plugin SDK - Validate\n'));

  const cwd = process.cwd();
  const manifestPath = path.join(cwd, options.manifest);

  // Check if manifest exists
  if (!await fs.pathExists(manifestPath)) {
    console.log(chalk.red(`Error: ${options.manifest} not found`));
    process.exit(1);
  }

  const spinner = ora('Validating plugin...').start();
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 1. Validate manifest
    spinner.text = 'Validating manifest...';
    const manifest = await fs.readJson(manifestPath);
    const manifestResult = validateManifest(manifest);
    
    if (!manifestResult.valid) {
      for (const error of manifestResult.errors) {
        errors.push(`manifest.json: ${error.path} - ${error.message}`);
      }
    }

    // 2. Check required files
    spinner.text = 'Checking required files...';
    const requiredFiles = [
      { path: 'package.json', required: true },
      { path: 'LICENSE', required: true },
      { path: 'README.md', required: false },
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(cwd, file.path);
      const exists = await fs.pathExists(filePath);
      
      if (!exists && file.required) {
        errors.push(`Missing required file: ${file.path}`);
      } else if (!exists && !file.required) {
        warnings.push(`Missing recommended file: ${file.path}`);
      }
    }

    // 3. Check entry point
    spinner.text = 'Checking entry point...';
    const packageJson = await fs.readJson(path.join(cwd, 'package.json'));
    const entryPoint = packageJson.main || 'src/index.js';
    const entryPath = path.join(cwd, entryPoint);
    
    // Check both .js and .ts versions
    const jsExists = await fs.pathExists(entryPath);
    const tsExists = await fs.pathExists(entryPath.replace('.js', '.ts'));
    
    if (!jsExists && !tsExists) {
      errors.push(`Entry point not found: ${entryPoint}`);
    }

    // 4. Check LICENSE content
    spinner.text = 'Checking license...';
    const licensePath = path.join(cwd, 'LICENSE');
    if (await fs.pathExists(licensePath)) {
      const licenseContent = await fs.readFile(licensePath, 'utf-8');
      if (!licenseContent.toLowerCase().includes('gpl') && 
          !licenseContent.toLowerCase().includes('gnu general public license')) {
        if (options.strict) {
          errors.push('LICENSE must be GPL-3.0 compatible');
        } else {
          warnings.push('LICENSE should be GPL-3.0 compatible for marketplace submission');
        }
      }
    }

    // 5. Check version format
    spinner.text = 'Checking version...';
    if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
      errors.push('Version must follow semver format (x.y.z)');
    }

    // 6. Check for sensitive data
    spinner.text = 'Checking for sensitive data...';
    const sensitivePatterns = [
      /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
      /secret\s*[:=]\s*['"][^'"]+['"]/gi,
      /password\s*[:=]\s*['"][^'"]+['"]/gi,
      /token\s*[:=]\s*['"][^'"]+['"]/gi,
    ];

    const srcDir = path.join(cwd, 'src');
    if (await fs.pathExists(srcDir)) {
      const sourceFiles = await getSourceFiles(srcDir);
      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf-8');
        for (const pattern of sensitivePatterns) {
          if (pattern.test(content)) {
            warnings.push(`Potential sensitive data in ${path.relative(cwd, file)}`);
            break;
          }
        }
      }
    }

    // 7. Strict mode checks
    if (options.strict) {
      spinner.text = 'Running strict validation...';
      
      // Check for tests
      const testsDir = path.join(cwd, 'tests');
      const testDir = path.join(cwd, 'test');
      if (!await fs.pathExists(testsDir) && !await fs.pathExists(testDir)) {
        warnings.push('No tests directory found');
      }

      // Check for documentation
      if (!manifest.description || manifest.description.length < 20) {
        warnings.push('Description should be at least 20 characters');
      }

      // Check for homepage/repository
      if (!manifest.homepage && !manifest.repository) {
        warnings.push('Consider adding homepage or repository URL');
      }
    }

    // Report results
    spinner.stop();

    if (errors.length === 0 && warnings.length === 0) {
      console.log(chalk.green('✅ Validation passed! No issues found.\n'));
    } else {
      if (errors.length > 0) {
        console.log(chalk.red(`\n❌ ${errors.length} error(s) found:\n`));
        for (const error of errors) {
          console.log(chalk.red(`  • ${error}`));
        }
      }

      if (warnings.length > 0) {
        console.log(chalk.yellow(`\n⚠️  ${warnings.length} warning(s):\n`));
        for (const warning of warnings) {
          console.log(chalk.yellow(`  • ${warning}`));
        }
      }

      console.log('');

      if (errors.length > 0) {
        console.log(chalk.red('Validation failed. Please fix the errors above.\n'));
        process.exit(1);
      } else {
        console.log(chalk.green('Validation passed with warnings.\n'));
      }
    }

  } catch (error) {
    spinner.fail(chalk.red('Validation failed'));
    console.error(error);
    process.exit(1);
  }
}

async function getSourceFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getSourceFiles(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

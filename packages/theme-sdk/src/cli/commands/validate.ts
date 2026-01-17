/**
 * Validate Command - Validate theme manifest and structure
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { validateThemeManifest, validateThemeTokens } from '../../validators';

interface ValidateOptions {
  manifest: string;
  strict: boolean;
}

export async function validateCommand(options: ValidateOptions) {
  console.log(chalk.blue('\n✅ Jiffoo Theme SDK - Validate\n'));

  const cwd = process.cwd();
  const manifestPath = path.join(cwd, options.manifest);

  // Check if manifest exists
  if (!await fs.pathExists(manifestPath)) {
    console.log(chalk.red(`Error: ${options.manifest} not found`));
    process.exit(1);
  }

  const spinner = ora('Validating theme...').start();
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 1. Validate manifest
    spinner.text = 'Validating manifest...';
    const manifest = await fs.readJson(manifestPath);
    const manifestResult = validateThemeManifest(manifest);
    
    if (!manifestResult.valid) {
      for (const error of manifestResult.errors) {
        errors.push(`manifest.json: ${error.path} - ${error.message}`);
      }
    }

    // 2. Validate tokens
    if (manifest.tokens) {
      spinner.text = 'Validating design tokens...';
      const tokensResult = validateThemeTokens(manifest.tokens);
      
      if (!tokensResult.valid) {
        for (const error of tokensResult.errors) {
          errors.push(`tokens: ${error.path} - ${error.message}`);
        }
      }
    }

    // 3. Check required files
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

    // 4. Check thumbnail
    if (manifest.thumbnail) {
      const thumbnailPath = path.join(cwd, 'public', path.basename(manifest.thumbnail));
      if (!await fs.pathExists(thumbnailPath)) {
        warnings.push(`Thumbnail not found: ${manifest.thumbnail}`);
      }
    } else {
      warnings.push('No thumbnail specified in manifest');
    }

    // 5. Check LICENSE content
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

    // 6. Check color contrast (accessibility)
    if (options.strict && manifest.tokens?.colors) {
      spinner.text = 'Checking color accessibility...';
      const colors = manifest.tokens.colors;
      
      if (colors.primary && colors.primaryForeground) {
        const contrast = calculateContrast(colors.primary, colors.primaryForeground);
        if (contrast < 4.5) {
          warnings.push(`Primary color contrast ratio (${contrast.toFixed(2)}) is below WCAG AA standard (4.5)`);
        }
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

// Simple contrast calculation
function calculateContrast(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getLuminance(hex: string): number {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

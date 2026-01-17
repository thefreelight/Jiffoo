#!/usr/bin/env node
/**
 * Jiffoo Theme SDK CLI Entry Point
 */

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { devCommand } from './commands/dev';
import { buildCommand } from './commands/build';
import { validateCommand } from './commands/validate';
import { packCommand } from './commands/pack';

const program = new Command();

program
  .name('jiffoo-theme')
  .description('CLI tools for Jiffoo theme development')
  .version('1.0.0');

// Init command - create new theme project
program
  .command('init [name]')
  .description('Create a new theme project')
  .option('-t, --template <template>', 'Template to use (basic, minimal, modern, luxury)', 'basic')
  .option('-d, --directory <dir>', 'Directory to create project in')
  .option('--typescript', 'Use TypeScript (default)', true)
  .option('--no-typescript', 'Use JavaScript')
  .action(initCommand);

// Dev command - start development server with preview
program
  .command('dev')
  .description('Start development server with live preview')
  .option('-p, --port <port>', 'Port to run on', '3002')
  .option('--mock', 'Use mock data for preview')
  .action(devCommand);

// Build command - build for production
program
  .command('build')
  .description('Build theme for production')
  .option('-o, --output <dir>', 'Output directory', 'dist')
  .action(buildCommand);

// Validate command - validate manifest and tokens
program
  .command('validate')
  .description('Validate theme manifest and structure')
  .option('-m, --manifest <path>', 'Path to manifest file', 'manifest.json')
  .option('--strict', 'Enable strict validation')
  .action(validateCommand);

// Pack command - package for submission
program
  .command('pack')
  .description('Package theme for submission to marketplace')
  .option('-o, --output <file>', 'Output file name')
  .option('--include-source', 'Include source files')
  .action(packCommand);

program.parse();

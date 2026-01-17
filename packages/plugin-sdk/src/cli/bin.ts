#!/usr/bin/env node
/**
 * Jiffoo Plugin SDK CLI Entry Point
 */

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { devCommand } from './commands/dev';
import { buildCommand } from './commands/build';
import { validateCommand } from './commands/validate';
import { packCommand } from './commands/pack';

const program = new Command();

program
  .name('jiffoo-plugin')
  .description('CLI tools for Jiffoo plugin development')
  .version('1.0.0');

// Init command - create new plugin project
program
  .command('init [name]')
  .description('Create a new plugin project')
  .option('-t, --template <template>', 'Template to use (basic, payment, email, integration)', 'basic')
  .option('-d, --directory <dir>', 'Directory to create project in')
  .option('--typescript', 'Use TypeScript (default)', true)
  .option('--no-typescript', 'Use JavaScript')
  .action(initCommand);

// Dev command - start development server
program
  .command('dev')
  .description('Start development server with hot reload')
  .option('-p, --port <port>', 'Port to run on', '3001')
  .option('--mock', 'Use mock API for testing')
  .option('--tunnel', 'Create public tunnel for testing')
  .action(devCommand);

// Build command - build for production
program
  .command('build')
  .description('Build plugin for production')
  .option('-o, --output <dir>', 'Output directory', 'dist')
  .option('--minify', 'Minify output', true)
  .option('--no-minify', 'Skip minification')
  .action(buildCommand);

// Validate command - validate manifest and code
program
  .command('validate')
  .description('Validate plugin manifest and structure')
  .option('-m, --manifest <path>', 'Path to manifest file', 'manifest.json')
  .option('--strict', 'Enable strict validation')
  .action(validateCommand);

// Pack command - package for submission
program
  .command('pack')
  .description('Package plugin for submission to marketplace')
  .option('-o, --output <file>', 'Output file name')
  .option('--include-source', 'Include source files')
  .action(packCommand);

program.parse();

/**
 * Dev Command - Start development server with hot reload
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { spawn, ChildProcess } from 'child_process';

interface DevOptions {
  port: string;
  mock: boolean;
  tunnel: boolean;
}

let serverProcess: ChildProcess | null = null;

export async function devCommand(options: DevOptions) {
  console.log(chalk.blue('\n🔧 Jiffoo Plugin SDK - Development Server\n'));

  const cwd = process.cwd();
  const manifestPath = path.join(cwd, 'manifest.json');
  const packagePath = path.join(cwd, 'package.json');

  // Check if we're in a plugin directory
  if (!await fs.pathExists(manifestPath)) {
    console.log(chalk.red('Error: manifest.json not found. Are you in a plugin directory?'));
    process.exit(1);
  }

  const manifest = await fs.readJson(manifestPath);
  const packageJson = await fs.readJson(packagePath);

  console.log(chalk.cyan(`Plugin: ${manifest.name} v${manifest.version}`));
  console.log(chalk.cyan(`Port: ${options.port}`));
  if (options.mock) {
    console.log(chalk.yellow('Mock mode enabled - using mock API'));
  }
  console.log('');

  // Set environment variables
  const env = {
    ...process.env,
    PORT: options.port,
    NODE_ENV: 'development',
    JIFFOO_MOCK_MODE: options.mock ? 'true' : 'false',
  };

  // Determine entry point
  const isTypeScript = await fs.pathExists(path.join(cwd, 'tsconfig.json'));
  let entryPoint: string;
  let command: string;
  let args: string[];

  if (isTypeScript) {
    // Use ts-node or tsx for TypeScript
    entryPoint = path.join(cwd, 'src', 'index.ts');
    command = 'npx';
    args = ['tsx', 'watch', entryPoint];
  } else {
    entryPoint = path.join(cwd, 'src', 'index.js');
    command = 'node';
    args = ['--watch', entryPoint];
  }

  if (!await fs.pathExists(entryPoint)) {
    console.log(chalk.red(`Error: Entry point not found: ${entryPoint}`));
    process.exit(1);
  }

  const spinner = ora('Starting development server...').start();

  try {
    serverProcess = spawn(command, args, {
      cwd,
      env,
      stdio: 'pipe',
    });

    let started = false;

    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (!started && output.includes('running on port')) {
        started = true;
        spinner.succeed(chalk.green('Development server started'));
        console.log('');
        console.log(chalk.cyan('Endpoints:'));
        console.log(`  ${chalk.yellow('Health:')}   http://localhost:${options.port}/health`);
        console.log(`  ${chalk.yellow('Manifest:')} http://localhost:${options.port}/manifest`);
        console.log(`  ${chalk.yellow('API:')}      http://localhost:${options.port}/api/*`);
        console.log('');
        console.log(chalk.gray('Watching for file changes...'));
        console.log(chalk.gray('Press Ctrl+C to stop\n'));
      }
      process.stdout.write(chalk.gray(output));
    });

    serverProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('error') || output.includes('Error')) {
        process.stderr.write(chalk.red(output));
      } else {
        process.stderr.write(chalk.yellow(output));
      }
    });

    serverProcess.on('error', (error) => {
      spinner.fail(chalk.red('Failed to start development server'));
      console.error(error);
      process.exit(1);
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.log(chalk.red(`\nServer exited with code ${code}`));
      }
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\nShutting down...'));
      if (serverProcess) {
        serverProcess.kill('SIGTERM');
      }
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      if (serverProcess) {
        serverProcess.kill('SIGTERM');
      }
      process.exit(0);
    });

  } catch (error) {
    spinner.fail(chalk.red('Failed to start development server'));
    console.error(error);
    process.exit(1);
  }
}

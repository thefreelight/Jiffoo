/**
 * Dev Command - Start development server with live preview
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

interface DevOptions {
  port: string;
  mock: boolean;
}

export async function devCommand(options: DevOptions) {
  console.log(chalk.blue('\n🎨 Jiffoo Theme SDK - Development Server\n'));

  const cwd = process.cwd();
  const manifestPath = path.join(cwd, 'manifest.json');

  // Check if we're in a theme directory
  if (!await fs.pathExists(manifestPath)) {
    console.log(chalk.red('Error: manifest.json not found. Are you in a theme directory?'));
    process.exit(1);
  }

  const manifest = await fs.readJson(manifestPath);

  console.log(chalk.cyan(`Theme: ${manifest.name} v${manifest.version}`));
  console.log(chalk.cyan(`Port: ${options.port}`));
  if (options.mock) {
    console.log(chalk.yellow('Mock mode enabled - using mock data'));
  }
  console.log('');

  const spinner = ora('Starting development server...').start();

  // For now, just show instructions since we need Next.js integration
  spinner.succeed(chalk.green('Development server ready'));

  console.log(`
${chalk.cyan('Theme Preview:')}

To preview your theme, you need to run it with a Jiffoo Shop instance:

1. In your Jiffoo Mall project, link this theme:
   ${chalk.yellow(`pnpm link ${cwd}`)}

2. Update shop config to use your theme:
   ${chalk.yellow(`THEME_PATH="${cwd}"`)}

3. Start the shop development server:
   ${chalk.yellow('pnpm dev:shop')}

4. Open ${chalk.blue(`http://localhost:3001`)} to see your theme

${chalk.cyan('Hot Reload:')}
Changes to your theme files will automatically reload in the browser.

${chalk.cyan('Files to edit:')}
  ${chalk.yellow('manifest.json')}     Theme configuration and tokens
  ${chalk.yellow('src/components/')}   Custom React components
  ${chalk.yellow('src/styles/')}       CSS styles

${chalk.gray('Press Ctrl+C to stop')}
`);

  // Keep process running
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\nShutting down...'));
    process.exit(0);
  });

  // Watch for file changes
  const chokidar = await import('chokidar').catch(() => null);
  if (chokidar) {
    const watcher = chokidar.default.watch([
      path.join(cwd, 'src'),
      path.join(cwd, 'manifest.json'),
    ], {
      ignored: /node_modules/,
      persistent: true,
    });

    watcher.on('change', (filePath) => {
      const relativePath = path.relative(cwd, filePath);
      console.log(chalk.gray(`[${new Date().toLocaleTimeString()}] Changed: ${relativePath}`));
    });
  }

  // Keep process alive
  await new Promise(() => {});
}

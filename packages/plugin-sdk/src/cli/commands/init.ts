import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

interface InitOptions { template: string; directory?: string; typescript: boolean; }

export async function initCommand(name: string | undefined, options: InitOptions) {
  const answers = await inquirer.prompt([
    { type: 'input', name: 'name', message: 'Plugin slug:', default: name || 'my-jiffoo-plugin' },
    { type: 'input', name: 'displayName', message: 'Display name:', default: name || 'My Jiffoo Plugin' },
    { type: 'input', name: 'description', message: 'Description:', default: 'A Jiffoo plugin' },
    { type: 'input', name: 'author', message: 'Author:', default: 'Jiffoo Developer' },
  ]);
  const slug = answers.name || name || 'my-jiffoo-plugin';
  const target = options.directory || path.join(process.cwd(), slug);
  if (await fs.pathExists(target)) throw new Error(`Directory already exists: ${target}`);
  const spinner = ora('Creating in-process plugin project...').start();
  try {
    await fs.ensureDir(path.join(target, 'src'));
    const extension = options.typescript ? 'ts' : 'js';
    await fs.writeJson(path.join(target, 'manifest.json'), {
      schemaVersion: 1, slug, name: answers.displayName, version: '1.0.0',
      description: answers.description, author: answers.author, category: 'other',
      runtimeType: 'internal-fastify', hostProtocol: 'internal-fastify-v1', trustLevel: 'unsigned',
      entryModule: options.typescript ? 'dist/index.js' : 'dist/src/index.js', permissions: [], capabilities: [],
    }, { spaces: 2 });
    await fs.writeJson(path.join(target, 'package.json'), {
      name: slug, version: '1.0.0', main: options.typescript ? 'dist/index.js' : 'dist/src/index.js',
      scripts: { build: options.typescript ? 'tsc' : 'echo "No build step"', validate: 'jiffoo-plugin validate', pack: 'jiffoo-plugin pack' },
      devDependencies: options.typescript ? { typescript: '^5.0.0', '@types/node': '^20.0.0' } : {}, license: 'GPL-3.0',
    }, { spaces: 2 });
    if (options.typescript) await fs.writeJson(path.join(target, 'tsconfig.json'), { compilerOptions: { target: 'ES2020', module: 'CommonJS', moduleResolution: 'node', outDir: './dist', rootDir: './src', strict: true, esModuleInterop: true, skipLibCheck: true }, include: ['src/**/*'] }, { spaces: 2 });
    await fs.writeFile(path.join(target, 'src', `index.${extension}`), `module.exports = async function plugin(fastify) {\n  fastify.get('/health', async () => ({ status: 'healthy' }));\n  fastify.get('/api/status', async (request) => ({ pluginSlug: request.headers['x-plugin-slug'], status: 'active' }));\n};\n`);
    await fs.writeFile(path.join(target, 'LICENSE'), 'GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n');
    spinner.succeed(chalk.green('In-process plugin project created.'));
  } catch (error) { spinner.fail('Failed to create plugin project'); throw error; }
}

#!/usr/bin/env node
/**
 * create-jiffoo-app
 *
 * Create a new Jiffoo e-commerce application with one command.
 * Similar to create-medusa-app, this tool clones the Jiffoo starter template
 * and guides users through the setup process.
 *
 * Usage:
 *   npx create-jiffoo-app my-store
 *   npx create-jiffoo-app my-store --template digital-goods
 *   npx create-jiffoo-app my-store --template esim --seed
 *   npx create-jiffoo-app my-store --skip-install
 */

import { Command } from 'commander';
import enquirer from 'enquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'node:path';
import { execa } from 'execa';
import {
    TEMPLATES,
    getTemplate,
    getStableTemplates,
    DEFAULT_TEMPLATE,
    type TemplateConfig,
} from './templates/registry.js';
import { applyTemplate } from './templates/applier.js';

const { prompt } = enquirer as { prompt: typeof enquirer.prompt };

const VERSION = '0.2.0';
const REPO_URL = 'https://github.com/thefreelight/Jiffoo.git';
const DEFAULT_BRANCH = 'main';

interface CreateOptions {
    skipInstall?: boolean;
    skipDb?: boolean;
    seed?: boolean;
    branch?: string;
    template?: string;
}

/**
 * Show banner
 */
function showBanner(): void {
    console.log(chalk.cyan(`
     ██╗██╗███████╗███████╗ ██████╗  ██████╗ 
     ██║██║██╔════╝██╔════╝██╔═══██╗██╔═══██╗
     ██║██║█████╗  █████╗  ██║   ██║██║   ██║
██   ██║██║██╔══╝  ██╔══╝  ██║   ██║██║   ██║
╚█████╔╝██║██║     ██║     ╚██████╔╝╚██████╔╝
 ╚════╝ ╚═╝╚═╝     ╚═╝      ╚═════╝  ╚═════╝ 
  `));
    console.log(chalk.bold(`     Create Jiffoo App v${VERSION}\n`));
    console.log(chalk.gray('     Modern E-commerce Platform\n'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log();
}

/**
 * Check prerequisites
 */
async function checkPrerequisites(): Promise<boolean> {
    const spinner = ora('Checking prerequisites...').start();
    const issues: string[] = [];

    // Check Node.js version
    const nodeVersion = process.version.slice(1);
    const [major] = nodeVersion.split('.').map(Number);
    if (major < 18) {
        issues.push(`Node.js 18+ required (current: ${process.version})`);
    }

    // Check pnpm
    try {
        await execa('pnpm', ['--version']);
    } catch {
        issues.push('pnpm is not installed. Install with: npm install -g pnpm');
    }

    // Check git
    try {
        await execa('git', ['--version']);
    } catch {
        issues.push('git is not installed');
    }

    spinner.stop();

    if (issues.length > 0) {
        console.log(chalk.red('\n✗ Prerequisites check failed:\n'));
        issues.forEach(issue => console.log(chalk.yellow(`  • ${issue}`)));
        console.log();
        return false;
    }

    console.log(chalk.green('✓ All prerequisites satisfied\n'));
    return true;
}

/**
 * Clone repository
 */
async function cloneRepository(
    projectName: string,
    branch: string
): Promise<string> {
    const targetDir = path.resolve(process.cwd(), projectName);

    // Check if directory exists
    if (await fs.pathExists(targetDir)) {
        const { overwrite } = await prompt<{ overwrite: boolean }>({
            type: 'confirm',
            name: 'overwrite',
            message: `Directory "${projectName}" already exists. Overwrite?`,
            initial: false,
        });

        if (!overwrite) {
            console.log(chalk.yellow('\nAborted.'));
            process.exit(0);
        }

        await fs.remove(targetDir);
    }

    const spinner = ora(`Cloning Jiffoo template into ${projectName}...`).start();

    try {
        await execa('git', [
            'clone',
            '--depth=1',
            '--branch',
            branch,
            REPO_URL,
            targetDir,
        ]);

        // Remove .git directory to start fresh
        await fs.remove(path.join(targetDir, '.git'));

        // Initialize new git repo
        await execa('git', ['init'], { cwd: targetDir });

        spinner.succeed('Template cloned successfully');
        return targetDir;
    } catch (error) {
        spinner.fail('Failed to clone template');
        throw error;
    }
}

/**
 * Install dependencies
 */
async function installDependencies(targetDir: string): Promise<void> {
    const spinner = ora('Installing dependencies (this may take a few minutes)...').start();

    try {
        await execa('pnpm', ['install'], {
            cwd: targetDir,
            stdio: 'pipe',
        });
        spinner.succeed('Dependencies installed');
    } catch (error) {
        spinner.fail('Failed to install dependencies');
        throw error;
    }
}

/**
 * Setup environment
 */
async function setupEnvironment(targetDir: string): Promise<void> {
    const envExample = path.join(targetDir, '.env.example');
    const envFile = path.join(targetDir, '.env');

    if (await fs.pathExists(envExample)) {
        await fs.copy(envExample, envFile);
        console.log(chalk.green('✓ Environment file created (.env)'));
    }
}

/**
 * Get project configuration from user
 */
async function getProjectConfig(): Promise<{
    dbHost: string;
    dbPort: string;
    dbName: string;
    dbUser: string;
    dbPassword: string;
}> {
    console.log(chalk.bold('\n🗄️  Database Configuration\n'));
    console.log(chalk.gray('PostgreSQL is required. Make sure it\'s running.\n'));

    const answers = await prompt<{
        dbHost: string;
        dbPort: string;
        dbName: string;
        dbUser: string;
        dbPassword: string;
    }>([
        {
            type: 'input',
            name: 'dbHost',
            message: 'Database host',
            initial: 'localhost',
        },
        {
            type: 'input',
            name: 'dbPort',
            message: 'Database port',
            initial: '5432',
        },
        {
            type: 'input',
            name: 'dbName',
            message: 'Database name',
            initial: 'jiffoo_db',
        },
        {
            type: 'input',
            name: 'dbUser',
            message: 'Database username',
            initial: 'postgres',
        },
        {
            type: 'password',
            name: 'dbPassword',
            message: 'Database password',
        },
    ]);

    return answers;
}

/**
 * Update .env file with database config
 */
async function updateEnvFile(
    targetDir: string,
    config: {
        dbHost: string;
        dbPort: string;
        dbName: string;
        dbUser: string;
        dbPassword: string;
    }
): Promise<void> {
    const envFile = path.join(targetDir, '.env');

    if (!(await fs.pathExists(envFile))) {
        return;
    }

    let content = await fs.readFile(envFile, 'utf-8');

    // Update database URL
    const dbUrl = `postgresql://${config.dbUser}:${config.dbPassword}@${config.dbHost}:${config.dbPort}/${config.dbName}`;
    content = content.replace(
        /DATABASE_URL=.*/,
        `DATABASE_URL="${dbUrl}"`
    );

    await fs.writeFile(envFile, content);
    console.log(chalk.green('✓ Database configuration updated'));
}

/**
 * Run database migrations
 */
async function runMigrations(targetDir: string): Promise<void> {
    const spinner = ora('Running database migrations...').start();

    try {
        await execa('pnpm', ['--filter', 'api', 'prisma', 'migrate', 'deploy'], {
            cwd: targetDir,
            stdio: 'pipe',
        });
        spinner.succeed('Database migrations completed');
    } catch (error) {
        spinner.fail('Failed to run migrations');
        console.log(chalk.yellow('\nYou can run migrations manually later with:'));
        console.log(chalk.cyan('  cd apps/api && pnpm prisma migrate deploy\n'));
    }
}

/**
 * Seed database
 */
async function seedDatabase(targetDir: string): Promise<void> {
    const spinner = ora('Seeding database with sample data...').start();

    try {
        await execa('pnpm', ['--filter', 'api', 'prisma', 'db', 'seed'], {
            cwd: targetDir,
            stdio: 'pipe',
        });
        spinner.succeed('Database seeded');
    } catch (error) {
        spinner.fail('Failed to seed database');
        console.log(chalk.yellow('\nYou can seed manually later with:'));
        console.log(chalk.cyan('  cd apps/api && pnpm prisma db seed\n'));
    }
}

/**
 * Show completion message
 */
function showComplete(projectName: string, template?: TemplateConfig): void {
    console.log(chalk.green.bold('\n✅ Your Jiffoo store is ready!\n'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log();

    if (template && template.name !== 'default') {
        console.log(chalk.bold(`🎨 Template: ${template.displayName}`));
        console.log(chalk.gray(`   ${template.description}`));
        console.log(chalk.gray(`   Theme: ${template.theme.slug} (${template.theme.packageName})`));
        console.log();
    }

    console.log(chalk.bold('📋 Next Steps:'));
    console.log();
    console.log(`   ${chalk.cyan('1.')} Navigate to your project:`);
    console.log(chalk.gray(`      cd ${projectName}`));
    console.log();
    console.log(`   ${chalk.cyan('2.')} Start development server:`);
    console.log(chalk.gray('      pnpm dev'));
    console.log();
    console.log(`   ${chalk.cyan('3.')} Open in browser:`);
    console.log(chalk.gray('      Shop:   http://localhost:3000'));
    console.log(chalk.gray('      Admin:  http://localhost:3003'));
    console.log(chalk.gray('      API:    http://localhost:4001'));
    console.log();
    console.log(chalk.gray('─'.repeat(50)));
    console.log();
    console.log(chalk.bold('📚 Documentation:'));
    console.log(chalk.gray('   https://docs.jiffoo.com'));
    console.log();
    console.log(chalk.bold('💬 Community:'));
    console.log(chalk.gray('   https://github.com/thefreelight/Jiffoo/discussions'));
    console.log();
    console.log(chalk.cyan('Thank you for choosing Jiffoo! 🎉\n'));
}

/**
 * Prompt the user to select a template.
 * Skipped if --template flag is provided.
 */
async function selectTemplate(
    flagValue?: string,
): Promise<TemplateConfig> {
    // If provided via flag, validate and return
    if (flagValue) {
        const template = getTemplate(flagValue);
        if (!template) {
            console.log(chalk.red(`\n✗ Unknown template: "${flagValue}"`));
            console.log(chalk.gray('Available templates:'));
            TEMPLATES.forEach((t) => {
                console.log(chalk.gray(`   • ${t.name} — ${t.displayName}`));
            });
            console.log();
            process.exit(1);
        }
        console.log(chalk.green(`✓ Using template: ${template.displayName}\n`));
        return template;
    }

    // Interactive selection
    console.log(chalk.bold('🎨 Select a template\n'));

    const stableTemplates = getStableTemplates();
    const choices = stableTemplates.map((t) => ({
        name: t.name,
        message: `${t.displayName}  ${chalk.gray('— ' + t.description)}`,
        value: t.name,
    }));

    const { selected } = await prompt<{ selected: string }>({
        type: 'select',
        name: 'selected',
        message: 'Choose a storefront template',
        choices,
        initial: 0,
    });

    const template = getTemplate(selected)!;
    console.log(chalk.green(`\n✓ Selected: ${template.displayName}\n`));
    return template;
}

/**
 * Main create function
 */
async function create(
    projectName: string | undefined,
    options: CreateOptions
): Promise<void> {
    showBanner();

    // Check prerequisites
    const prereqOk = await checkPrerequisites();
    if (!prereqOk) {
        process.exit(1);
    }

    // Select template (from flag or interactive prompt)
    const template = await selectTemplate(options.template);

    // Get project name if not provided
    if (!projectName) {
        const { name } = await prompt<{ name: string }>({
            type: 'input',
            name: 'name',
            message: 'What is your project name?',
            initial: `my-${template.name}-store`,
            validate: (value: string) => {
                if (!value.trim()) {
                    return 'Project name is required';
                }
                if (!/^[a-z0-9-_]+$/i.test(value)) {
                    return 'Project name can only contain letters, numbers, hyphens and underscores';
                }
                return true;
            },
        });
        projectName = name;
    }

    console.log();

    // Clone repository
    const branch = options.branch || DEFAULT_BRANCH;
    const targetDir = await cloneRepository(projectName!, branch);

    // Setup environment
    await setupEnvironment(targetDir);

    // Apply template configuration (env presets, theme activation, seed data)
    const applySpinner = ora(`Applying template: ${template.displayName}...`).start();
    try {
        const result = await applyTemplate(targetDir, template);
        applySpinner.succeed(`Template applied: ${template.displayName}`);
        if (result.envKeysWritten.length > 0) {
            console.log(chalk.gray(`   Env presets: ${result.envKeysWritten.join(', ')}`));
        }
        if (result.seedDataPath) {
            console.log(chalk.gray(`   Seed data: ${path.relative(targetDir, result.seedDataPath)}`));
        }
        console.log();
    } catch (error) {
        applySpinner.fail('Failed to apply template configuration');
        console.log(chalk.yellow('You can configure the template manually after setup.'));
    }

    if (!options.skipInstall) {
        // Get database configuration
        const dbConfig = await getProjectConfig();

        // Update .env file
        await updateEnvFile(targetDir, dbConfig);

        // Install dependencies
        await installDependencies(targetDir);

        if (!options.skipDb) {
            // Run migrations
            await runMigrations(targetDir);

            // Seed database if requested
            // If a non-default template is selected and --seed is not explicitly
            // set, auto-seed since the template includes tailored sample data.
            const shouldSeed = options.seed || (template.name !== DEFAULT_TEMPLATE);
            if (shouldSeed) {
                await seedDatabase(targetDir);
            }
        }
    }

    // Show completion message
    showComplete(projectName!, template);
}

// Create CLI program
const program = new Command();

program
    .name('create-jiffoo-app')
    .description('Create a new Jiffoo e-commerce application')
    .version(VERSION)
    .argument('[project-name]', 'Name of the project directory')
    .option('--skip-install', 'Skip installing dependencies')
    .option('--skip-db', 'Skip database setup')
    .option('--seed', 'Seed database with sample data')
    .option('--branch <branch>', 'Branch to clone from', DEFAULT_BRANCH)
    .option(
        '--template <name>',
        `Storefront template (default, digital-goods, esim)`,
    )
    .action(create);

program.parse();

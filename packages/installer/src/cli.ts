/**
 * Jiffoo Mall Installer - CLI
 * 
 * Interactive command-line installation wizard
 */

import { Command } from 'commander';
import { prompt } from 'enquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'node:path';

import {
    checkEnvironment,
    getEnvironmentSummary,
    formatBytes,
    generateJwtSecret,
    generateRandomPassword,
    writeConfigFiles,
    testDatabaseConnection,
    initializeDatabase,
    getDatabaseErrorSuggestion,
} from './index.js';

import type {
    InstallConfig,
    DatabaseConfig,
    AdminConfig,
    SiteConfig,
    ServicesConfig,
    RedisConfig,
} from './types.js';

import { DEFAULTS, REQUIREMENTS } from './types.js';

const VERSION = '1.0.0';

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
    console.log(chalk.bold(`     Jiffoo Mall Installer v${VERSION}\n`));
    console.log(chalk.gray('     https://jiffoo.com\n'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log();
}

/**
 * Check environment and display results
 */
async function checkAndDisplayEnvironment(): Promise<boolean> {
    const spinner = ora('Checking system environment...').start();

    const result = await checkEnvironment();

    spinner.stop();

    console.log(chalk.bold('\n📋 System Requirements Check\n'));

    const summary = getEnvironmentSummary(result);
    summary.forEach(line => {
        if (line.includes('✓')) {
            console.log(chalk.green('  ' + line));
        } else if (line.includes('✗')) {
            console.log(chalk.red('  ' + line));
        } else {
            console.log('  ' + line);
        }
    });

    console.log();

    if (!result.allSatisfied) {
        console.log(chalk.yellow('⚠️  Some requirements are not met. Installation may fail.'));

        const { proceed } = await prompt<{ proceed: boolean }>({
            type: 'confirm',
            name: 'proceed',
            message: 'Do you want to continue anyway?',
            initial: false,
        });

        return proceed;
    }

    console.log(chalk.green('✓ All requirements satisfied!'));
    return true;
}

/**
 * Get database configuration from user
 */
async function getDatabaseConfig(): Promise<DatabaseConfig> {
    console.log(chalk.bold('\n🗄️  Database Configuration\n'));

    const answers = await prompt<{
        type: 'postgresql' | 'mysql';
        host: string;
        port: string;
        name: string;
        user: string;
        password: string;
    }>([
        {
            type: 'select',
            name: 'type',
            message: 'Database type',
            choices: [
                { name: 'postgresql', message: 'PostgreSQL (recommended)' },
                { name: 'mysql', message: 'MySQL' },
            ],
            initial: 0,
        },
        {
            type: 'input',
            name: 'host',
            message: 'Database host',
            initial: DEFAULTS.database?.host,
        },
        {
            type: 'input',
            name: 'port',
            message: 'Database port',
            initial: (state: any) => state.answers.type === 'mysql' ? '3306' : '5432',
        },
        {
            type: 'input',
            name: 'name',
            message: 'Database name',
            initial: DEFAULTS.database?.name,
        },
        {
            type: 'input',
            name: 'user',
            message: 'Database username',
            initial: (state: any) => state.answers.type === 'mysql' ? 'root' : 'postgres',
        },
        {
            type: 'password',
            name: 'password',
            message: 'Database password',
        },
    ]);

    const config: DatabaseConfig = {
        type: answers.type,
        host: answers.host,
        port: parseInt(answers.port, 10),
        name: answers.name,
        user: answers.user,
        password: answers.password,
    };

    // Test connection
    const spinner = ora('Testing database connection...').start();
    const result = await testDatabaseConnection(config);
    spinner.stop();

    if (!result.canConnect && !result.error?.includes('does not exist')) {
        console.log(chalk.red('\n✗ ' + result.error));
        console.log(chalk.yellow('  ' + getDatabaseErrorSuggestion(result.error || '')));

        const { retry } = await prompt<{ retry: boolean }>({
            type: 'confirm',
            name: 'retry',
            message: 'Would you like to re-enter database configuration?',
            initial: true,
        });

        if (retry) {
            return getDatabaseConfig();
        }
    } else if (result.error?.includes('does not exist')) {
        console.log(chalk.yellow('\n⚠️  ' + result.error));
    } else {
        console.log(chalk.green('\n✓ Database connection successful!'));
    }

    return config;
}

/**
 * Get Redis configuration from user
 */
async function getRedisConfig(): Promise<RedisConfig> {
    console.log(chalk.bold('\n📦 Redis Configuration\n'));

    const answers = await prompt<{
        host: string;
        port: string;
        password: string;
    }>([
        {
            type: 'input',
            name: 'host',
            message: 'Redis host',
            initial: DEFAULTS.redis?.host,
        },
        {
            type: 'input',
            name: 'port',
            message: 'Redis port',
            initial: String(DEFAULTS.redis?.port),
        },
        {
            type: 'password',
            name: 'password',
            message: 'Redis password (leave empty if none)',
        },
    ]);

    return {
        host: answers.host,
        port: parseInt(answers.port, 10),
        password: answers.password || undefined,
    };
}

/**
 * Get admin user configuration
 */
async function getAdminConfig(): Promise<AdminConfig> {
    console.log(chalk.bold('\n👤 Administrator Account\n'));

    const answers = await prompt<{
        email: string;
        name: string;
        password: string;
        confirmPassword: string;
    }>([
        {
            type: 'input',
            name: 'email',
            message: 'Admin email',
            validate: (value: string) => {
                if (!value.includes('@')) {
                    return 'Please enter a valid email address';
                }
                return true;
            },
        },
        {
            type: 'input',
            name: 'name',
            message: 'Admin name',
            initial: 'Administrator',
        },
        {
            type: 'password',
            name: 'password',
            message: 'Admin password',
            validate: (value: string) => {
                if (value.length < 8) {
                    return 'Password must be at least 8 characters';
                }
                return true;
            },
        },
        {
            type: 'password',
            name: 'confirmPassword',
            message: 'Confirm password',
            validate: ((value: string, state: any) => {
                if (value !== state.answers.password) {
                    return 'Passwords do not match';
                }
                return true;
            }) as any,
        },
    ]);

    return {
        email: answers.email,
        name: answers.name,
        password: answers.password,
    };
}

/**
 * Get site configuration
 */
async function getSiteConfig(): Promise<SiteConfig> {
    console.log(chalk.bold('\n🏪 Store Configuration\n'));

    const answers = await prompt<{
        name: string;
        url: string;
        locale: string;
        timezone: string;
    }>([
        {
            type: 'input',
            name: 'name',
            message: 'Store name',
            initial: DEFAULTS.site?.name,
        },
        {
            type: 'input',
            name: 'url',
            message: 'Store URL (e.g., https://your-domain.com)',
            initial: DEFAULTS.site?.url,
        },
        {
            type: 'select',
            name: 'locale',
            message: 'Default language',
            choices: [
                { name: 'en', message: 'English' },
                { name: 'zh-Hant', message: 'Traditional Chinese' },
            ],
            initial: 0,
        },
        {
            type: 'input',
            name: 'timezone',
            message: 'Timezone',
            initial: 'UTC',
        },
    ]);

    return {
        name: answers.name,
        url: answers.url,
        locale: answers.locale,
        timezone: answers.timezone,
    };
}

/**
 * Get services port configuration
 */
async function getServicesConfig(): Promise<ServicesConfig> {
    console.log(chalk.bold('\n🔌 Service Ports\n'));

    const { customPorts } = await prompt<{ customPorts: boolean }>({
        type: 'confirm',
        name: 'customPorts',
        message: 'Would you like to customize service ports?',
        initial: false,
    });

    if (!customPorts) {
        return DEFAULTS.services as ServicesConfig;
    }

    const answers = await prompt<{
        apiPort: string;
        shopPort: string;
        adminPort: string;
        superAdminPort: string;
    }>([
        {
            type: 'input',
            name: 'apiPort',
            message: 'API port',
            initial: String(DEFAULTS.services?.apiPort),
        },
        {
            type: 'input',
            name: 'shopPort',
            message: 'Shop port',
            initial: String(DEFAULTS.services?.shopPort),
        },
        {
            type: 'input',
            name: 'adminPort',
            message: 'Admin port',
            initial: String(DEFAULTS.services?.adminPort),
        },
        {
            type: 'input',
            name: 'superAdminPort',
            message: 'Super Admin port',
            initial: String(DEFAULTS.services?.superAdminPort),
        },
    ]);

    return {
        apiPort: parseInt(answers.apiPort, 10),
        shopPort: parseInt(answers.shopPort, 10),
        adminPort: parseInt(answers.adminPort, 10),
        superAdminPort: parseInt(answers.superAdminPort, 10),
    };
}

/**
 * Run installation
 */
async function runInstallation(config: InstallConfig, targetDir: string): Promise<void> {
    console.log(chalk.bold('\n🚀 Starting Installation\n'));

    // Step 1: Write config files
    let spinner = ora('Writing configuration files...').start();
    try {
        await writeConfigFiles(config, targetDir, {
            writeEnv: true,
            writePm2Config: true,
        });
        spinner.succeed('Configuration files written');
    } catch (error) {
        spinner.fail('Failed to write configuration files');
        throw error;
    }

    // Step 2: Initialize database
    spinner = ora('Initializing database...').start();
    try {
        await initializeDatabase(config.database, targetDir, (message) => {
            spinner.text = message;
        });
        spinner.succeed('Database initialized');
    } catch (error) {
        spinner.fail('Failed to initialize database');
        throw error;
    }

    // Step 3: Install dependencies
    spinner = ora('Installing dependencies...').start();
    try {
        const { execSync } = await import('node:child_process');
        execSync('pnpm install --frozen-lockfile', {
            cwd: targetDir,
            stdio: 'pipe',
        });
        spinner.succeed('Dependencies installed');
    } catch (error) {
        spinner.fail('Failed to install dependencies');
        throw error;
    }

    // Step 4: Build application
    spinner = ora('Building application...').start();
    try {
        const { execSync } = await import('node:child_process');
        execSync('pnpm run build', {
            cwd: targetDir,
            stdio: 'pipe',
        });
        spinner.succeed('Application built');
    } catch (error) {
        spinner.fail('Failed to build application');
        throw error;
    }

    console.log();
}

/**
 * Show installation complete message
 */
function showComplete(config: InstallConfig): void {
    const siteUrl = config.site.url.replace(/\/$/, '');

    console.log(chalk.green.bold('\n✅ Installation Complete!\n'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log();
    console.log(chalk.bold('🌐 Access your store:'));
    console.log();
    console.log(`   ${chalk.cyan('Shop:')}        ${siteUrl}:${config.services.shopPort}`);
    console.log(`   ${chalk.cyan('Admin:')}       ${siteUrl}:${config.services.adminPort}`);
    console.log(`   ${chalk.cyan('Super Admin:')} ${siteUrl}:${config.services.superAdminPort}`);
    console.log(`   ${chalk.cyan('API:')}         ${siteUrl}:${config.services.apiPort}`);
    console.log();
    console.log(chalk.bold('👤 Administrator Account:'));
    console.log();
    console.log(`   ${chalk.cyan('Email:')}    ${config.admin.email}`);
    console.log(`   ${chalk.cyan('Password:')} (the password you entered)`);
    console.log();
    console.log(chalk.gray('─'.repeat(50)));
    console.log();
    console.log(chalk.bold('📋 Next Steps:'));
    console.log();
    console.log('   1. Start the services:');
    console.log(chalk.cyan('      pm2 start ecosystem.config.js'));
    console.log();
    console.log('   2. Enable auto-start on boot:');
    console.log(chalk.cyan('      pm2 save && pm2 startup'));
    console.log();
    console.log('   3. View logs:');
    console.log(chalk.cyan('      pm2 logs'));
    console.log();
    console.log(chalk.gray('─'.repeat(50)));
    console.log();
    console.log(chalk.cyan('Thank you for using Jiffoo Mall! 🎉'));
    console.log();
}

/**
 * Main install command
 */
async function install(options: { dir?: string; skip?: boolean }): Promise<void> {
    showBanner();

    // Check environment
    if (!options.skip) {
        const proceed = await checkAndDisplayEnvironment();
        if (!proceed) {
            console.log(chalk.yellow('\nInstallation cancelled.'));
            process.exit(0);
        }
    }

    // Get configuration
    const database = await getDatabaseConfig();
    const redis = await getRedisConfig();
    const admin = await getAdminConfig();
    const site = await getSiteConfig();
    const services = await getServicesConfig();
    const jwtSecret = generateJwtSecret();

    const config: InstallConfig = {
        database,
        redis,
        admin,
        site,
        services,
        jwtSecret,
    };

    // Confirm installation
    console.log(chalk.bold('\n📋 Installation Summary\n'));
    console.log(`   Database: ${config.database.type}://${config.database.host}:${config.database.port}/${config.database.name}`);
    console.log(`   Redis: ${config.redis.host}:${config.redis.port}`);
    console.log(`   Admin: ${config.admin.email}`);
    console.log(`   Store: ${config.site.name}`);
    console.log();

    const { confirm } = await prompt<{ confirm: boolean }>({
        type: 'confirm',
        name: 'confirm',
        message: 'Proceed with installation?',
        initial: true,
    });

    if (!confirm) {
        console.log(chalk.yellow('\nInstallation cancelled.'));
        process.exit(0);
    }

    // Run installation
    const targetDir = options.dir || process.cwd();
    await runInstallation(config, targetDir);

    // Show complete message
    showComplete(config);
}

/**
 * Check command - check environment only
 */
async function check(): Promise<void> {
    showBanner();
    await checkAndDisplayEnvironment();
}

// Create CLI program
const program = new Command();

program
    .name('jiffoo-install')
    .description('Jiffoo Mall CLI Installer')
    .version(VERSION);

program
    .command('install', { isDefault: true })
    .description('Install Jiffoo Mall')
    .option('-d, --dir <directory>', 'Installation directory')
    .option('-s, --skip', 'Skip environment check')
    .action(install);

program
    .command('check')
    .description('Check system requirements')
    .action(check);

program.parse();

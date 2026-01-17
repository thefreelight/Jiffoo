/**
 * Jiffoo Mall Installer - Database Initializer
 * 
 * Validates database connection and runs migrations
 */

import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import type { DatabaseConfig, DatabaseCheckInfo, InstallError, InstallErrorType } from './types.js';

/**
 * Test database connection
 */
export async function testDatabaseConnection(config: DatabaseConfig): Promise<DatabaseCheckInfo> {
    const { type, host, port, user, password, name } = config;

    try {
        if (type === 'postgresql') {
            return await testPostgresConnection(host, port, user, password, name);
        } else if (type === 'mysql') {
            return await testMysqlConnection(host, port, user, password, name);
        }

        return {
            reachable: false,
            canConnect: false,
            error: `Unsupported database type: ${type}`,
        };
    } catch (error) {
        return {
            reachable: false,
            canConnect: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Test PostgreSQL connection using psql
 */
async function testPostgresConnection(
    host: string,
    port: number,
    user: string,
    password: string,
    database: string
): Promise<DatabaseCheckInfo> {
    return new Promise((resolve) => {
        const env = {
            ...process.env,
            PGPASSWORD: password,
        };

        try {
            // Try to connect to the database
            execSync(
                `psql -h ${host} -p ${port} -U ${user} -d ${database} -c "SELECT 1" 2>&1`,
                { env, timeout: 10000 }
            );

            resolve({
                reachable: true,
                canConnect: true,
            });
        } catch (error: any) {
            const errorMessage = error.message || String(error);

            // Check if database doesn't exist
            if (errorMessage.includes('does not exist')) {
                // Try connecting to 'postgres' database to check if server is reachable
                try {
                    execSync(
                        `psql -h ${host} -p ${port} -U ${user} -d postgres -c "SELECT 1" 2>&1`,
                        { env, timeout: 10000 }
                    );

                    resolve({
                        reachable: true,
                        canConnect: true, // Server is reachable, just database doesn't exist
                        error: `Database "${database}" does not exist. It will be created.`,
                    });
                } catch {
                    resolve({
                        reachable: false,
                        canConnect: false,
                        error: 'Cannot connect to PostgreSQL server',
                    });
                }
            } else if (errorMessage.includes('Connection refused')) {
                resolve({
                    reachable: false,
                    canConnect: false,
                    error: `Cannot reach PostgreSQL server at ${host}:${port}`,
                });
            } else if (errorMessage.includes('authentication failed')) {
                resolve({
                    reachable: true,
                    canConnect: false,
                    error: 'Authentication failed. Please check username and password.',
                });
            } else {
                resolve({
                    reachable: false,
                    canConnect: false,
                    error: errorMessage,
                });
            }
        }
    });
}

/**
 * Test MySQL connection using mysql cli
 */
async function testMysqlConnection(
    host: string,
    port: number,
    user: string,
    password: string,
    database: string
): Promise<DatabaseCheckInfo> {
    return new Promise((resolve) => {
        try {
            execSync(
                `mysql -h ${host} -P ${port} -u ${user} -p'${password}' -e "SELECT 1" ${database} 2>&1`,
                { timeout: 10000 }
            );

            resolve({
                reachable: true,
                canConnect: true,
            });
        } catch (error: any) {
            const errorMessage = error.message || String(error);

            if (errorMessage.includes("Unknown database")) {
                resolve({
                    reachable: true,
                    canConnect: true,
                    error: `Database "${database}" does not exist. It will be created.`,
                });
            } else if (errorMessage.includes('Connection refused') || errorMessage.includes("Can't connect")) {
                resolve({
                    reachable: false,
                    canConnect: false,
                    error: `Cannot reach MySQL server at ${host}:${port}`,
                });
            } else if (errorMessage.includes('Access denied')) {
                resolve({
                    reachable: true,
                    canConnect: false,
                    error: 'Access denied. Please check username and password.',
                });
            } else {
                resolve({
                    reachable: false,
                    canConnect: false,
                    error: errorMessage,
                });
            }
        }
    });
}

/**
 * Create database if it doesn't exist
 */
export async function createDatabase(config: DatabaseConfig): Promise<void> {
    const { type, host, port, user, password, name } = config;

    if (type === 'postgresql') {
        const env = { ...process.env, PGPASSWORD: password };

        try {
            // Check if database exists
            execSync(
                `psql -h ${host} -p ${port} -U ${user} -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='${name}'" 2>&1`,
                { env }
            );

            // Create database if it doesn't exist
            execSync(
                `psql -h ${host} -p ${port} -U ${user} -d postgres -c "CREATE DATABASE ${name}" 2>&1`,
                { env }
            );
        } catch (error: any) {
            // Database might already exist, which is fine
            if (!error.message?.includes('already exists')) {
                throw error;
            }
        }
    } else if (type === 'mysql') {
        try {
            execSync(
                `mysql -h ${host} -P ${port} -u ${user} -p'${password}' -e "CREATE DATABASE IF NOT EXISTS ${name}" 2>&1`
            );
        } catch (error) {
            throw error;
        }
    }
}

/**
 * Run Prisma migrations
 */
export async function runMigrations(
    projectDir: string,
    onProgress?: (message: string) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        onProgress?.('Generating Prisma Client...');

        try {
            execSync('pnpm run prisma:generate', {
                cwd: projectDir,
                stdio: 'pipe',
            });
        } catch (error) {
            reject(new Error('Failed to generate Prisma Client'));
            return;
        }

        onProgress?.('Running database migrations...');

        try {
            execSync('pnpm run prisma:migrate:deploy', {
                cwd: projectDir,
                stdio: 'pipe',
            });
        } catch (error) {
            reject(new Error('Failed to run database migrations'));
            return;
        }

        resolve();
    });
}

/**
 * Seed the database with initial data
 */
export async function seedDatabase(
    projectDir: string,
    onProgress?: (message: string) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        onProgress?.('Seeding database with initial data...');

        try {
            execSync('pnpm run prisma:seed', {
                cwd: projectDir,
                stdio: 'pipe',
            });
            resolve();
        } catch (error) {
            // Seeding is optional, don't fail the entire install
            onProgress?.('Warning: Database seeding skipped or failed');
            resolve();
        }
    });
}

/**
 * Initialize database (create, migrate, seed)
 */
export async function initializeDatabase(
    config: DatabaseConfig,
    projectDir: string,
    onProgress?: (message: string) => void
): Promise<void> {
    // Test connection
    onProgress?.('Testing database connection...');
    const connectionResult = await testDatabaseConnection(config);

    if (!connectionResult.canConnect) {
        throw new Error(connectionResult.error || 'Cannot connect to database');
    }

    // Create database if needed
    if (connectionResult.error?.includes('does not exist')) {
        onProgress?.(`Creating database "${config.name}"...`);
        await createDatabase(config);
    }

    // Run migrations
    await runMigrations(projectDir, onProgress);

    // Seed database
    await seedDatabase(projectDir, onProgress);
}

/**
 * Get database connection error suggestion
 */
export function getDatabaseErrorSuggestion(error: string): string {
    if (error.includes('Connection refused') || error.includes("Can't connect")) {
        return 'Make sure the database server is running and accessible on the specified host and port.';
    }
    if (error.includes('authentication failed') || error.includes('Access denied')) {
        return 'Check that the username and password are correct.';
    }
    if (error.includes('does not exist')) {
        return 'The database will be created automatically during installation.';
    }
    return 'Check your database configuration and ensure the server is running.';
}

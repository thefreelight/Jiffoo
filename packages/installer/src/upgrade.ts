/**
 * Jiffoo Mall Installer - Upgrade and Migration Tools
 * 
 * Handles system upgrades, backups, and data migration
 */

import fs from 'fs-extra';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { createGzip, createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import type { DatabaseConfig } from './types.js';

/**
 * Backup result
 */
export interface BackupResult {
    success: boolean;
    backupPath: string;
    timestamp: Date;
    size: number;
    components: {
        database: boolean;
        config: boolean;
        uploads: boolean;
    };
    error?: string;
}

/**
 * Upgrade result
 */
export interface UpgradeResult {
    success: boolean;
    fromVersion: string;
    toVersion: string;
    migrationsRun: number;
    backupPath?: string;
    error?: string;
}

/**
 * Get current version from package.json
 */
export function getCurrentVersion(projectDir: string): string {
    try {
        const packageJson = fs.readJsonSync(path.join(projectDir, 'package.json'));
        return packageJson.version || '0.0.0';
    } catch {
        return '0.0.0';
    }
}

/**
 * Get latest version from GitHub
 */
export async function getLatestVersion(): Promise<string> {
    try {
        const response = await fetch(
            'https://api.github.com/repos/jiffoo/mall/releases/latest'
        );
        const data = await response.json() as { tag_name: string };
        return data.tag_name?.replace('v', '') || '0.0.0';
    } catch {
        return '0.0.0';
    }
}

/**
 * Compare semantic versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
        const numA = partsA[i] || 0;
        const numB = partsB[i] || 0;
        if (numA < numB) return -1;
        if (numA > numB) return 1;
    }

    return 0;
}

/**
 * Create timestamp string for backup naming
 */
function getBackupTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Backup PostgreSQL database
 */
export async function backupPostgresDatabase(
    config: DatabaseConfig,
    outputPath: string
): Promise<void> {
    const { host, port, user, password, name } = config;
    const env = { ...process.env, PGPASSWORD: password };

    const dumpFile = outputPath.endsWith('.gz')
        ? outputPath.slice(0, -3)
        : outputPath;

    // Run pg_dump
    execSync(
        `pg_dump -h ${host} -p ${port} -U ${user} -d ${name} -F c -f "${dumpFile}"`,
        { env }
    );

    // Compress if needed
    if (outputPath.endsWith('.gz')) {
        await pipeline(
            createReadStream(dumpFile),
            createGzip(),
            createWriteStream(outputPath)
        );
        await fs.remove(dumpFile);
    }
}

/**
 * Backup MySQL database
 */
export async function backupMysqlDatabase(
    config: DatabaseConfig,
    outputPath: string
): Promise<void> {
    const { host, port, user, password, name } = config;

    const dumpFile = outputPath.endsWith('.gz')
        ? outputPath.slice(0, -3)
        : outputPath;

    // Run mysqldump
    execSync(
        `mysqldump -h ${host} -P ${port} -u ${user} -p'${password}' ${name} > "${dumpFile}"`,
        { shell: '/bin/bash' }
    );

    // Compress if needed
    if (outputPath.endsWith('.gz')) {
        await pipeline(
            createReadStream(dumpFile),
            createGzip(),
            createWriteStream(outputPath)
        );
        await fs.remove(dumpFile);
    }
}

/**
 * Create full backup
 */
export async function createBackup(
    projectDir: string,
    dbConfig: DatabaseConfig,
    options: {
        includeUploads?: boolean;
        outputDir?: string;
    } = {}
): Promise<BackupResult> {
    const { includeUploads = true, outputDir } = options;
    const timestamp = getBackupTimestamp();
    const backupDir = outputDir || path.join(projectDir, 'backups');
    const backupPath = path.join(backupDir, `backup-${timestamp}`);

    await fs.ensureDir(backupPath);

    const result: BackupResult = {
        success: false,
        backupPath,
        timestamp: new Date(),
        size: 0,
        components: {
            database: false,
            config: false,
            uploads: false,
        },
    };

    try {
        // 1. Backup database
        const dbBackupPath = path.join(backupPath, 'database.dump.gz');
        if (dbConfig.type === 'postgresql') {
            await backupPostgresDatabase(dbConfig, dbBackupPath);
        } else {
            await backupMysqlDatabase(dbConfig, dbBackupPath);
        }
        result.components.database = true;

        // 2. Backup configuration files
        const configFiles = ['.env', 'ecosystem.config.js', 'docker-compose.yml'];
        const configBackupDir = path.join(backupPath, 'config');
        await fs.ensureDir(configBackupDir);

        for (const file of configFiles) {
            const srcPath = path.join(projectDir, file);
            if (await fs.pathExists(srcPath)) {
                await fs.copy(srcPath, path.join(configBackupDir, file));
            }
        }
        result.components.config = true;

        // 3. Backup uploads (if requested)
        if (includeUploads) {
            const uploadsDir = path.join(projectDir, 'uploads');
            if (await fs.pathExists(uploadsDir)) {
                await fs.copy(uploadsDir, path.join(backupPath, 'uploads'));
                result.components.uploads = true;
            }
        }

        // 4. Create backup manifest
        const manifest = {
            version: getCurrentVersion(projectDir),
            timestamp: result.timestamp.toISOString(),
            components: result.components,
            database: {
                type: dbConfig.type,
                name: dbConfig.name,
            },
        };
        await fs.writeJson(path.join(backupPath, 'manifest.json'), manifest, { spaces: 2 });

        // 5. Calculate total size
        const stats = await getDirSize(backupPath);
        result.size = stats;

        result.success = true;
    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
}

/**
 * Get directory size recursively
 */
async function getDirSize(dir: string): Promise<number> {
    let size = 0;
    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
        const itemPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            size += await getDirSize(itemPath);
        } else {
            const stats = await fs.stat(itemPath);
            size += stats.size;
        }
    }

    return size;
}

/**
 * Restore from backup
 */
export async function restoreFromBackup(
    backupPath: string,
    projectDir: string,
    dbConfig: DatabaseConfig,
    options: {
        restoreDatabase?: boolean;
        restoreConfig?: boolean;
        restoreUploads?: boolean;
    } = {}
): Promise<{ success: boolean; error?: string }> {
    const {
        restoreDatabase = true,
        restoreConfig = true,
        restoreUploads = true,
    } = options;

    try {
        // Check manifest
        const manifestPath = path.join(backupPath, 'manifest.json');
        if (!await fs.pathExists(manifestPath)) {
            throw new Error('Invalid backup: manifest.json not found');
        }

        const manifest = await fs.readJson(manifestPath);

        // 1. Restore database
        if (restoreDatabase && manifest.components.database) {
            const dbBackupPath = path.join(backupPath, 'database.dump.gz');

            if (dbConfig.type === 'postgresql') {
                const tempFile = path.join(backupPath, 'database.dump');
                await pipeline(
                    createReadStream(dbBackupPath),
                    createGunzip(),
                    createWriteStream(tempFile)
                );

                const env = { ...process.env, PGPASSWORD: dbConfig.password };
                execSync(
                    `pg_restore -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.name} -c "${tempFile}"`,
                    { env }
                );

                await fs.remove(tempFile);
            } else {
                // MySQL restore
                const tempFile = path.join(backupPath, 'database.sql');
                await pipeline(
                    createReadStream(dbBackupPath),
                    createGunzip(),
                    createWriteStream(tempFile)
                );

                execSync(
                    `mysql -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} -p'${dbConfig.password}' ${dbConfig.name} < "${tempFile}"`,
                    { shell: '/bin/bash' }
                );

                await fs.remove(tempFile);
            }
        }

        // 2. Restore configuration
        if (restoreConfig && manifest.components.config) {
            const configBackupDir = path.join(backupPath, 'config');
            const configFiles = await fs.readdir(configBackupDir);

            for (const file of configFiles) {
                await fs.copy(
                    path.join(configBackupDir, file),
                    path.join(projectDir, file)
                );
            }
        }

        // 3. Restore uploads
        if (restoreUploads && manifest.components.uploads) {
            const uploadsBackupDir = path.join(backupPath, 'uploads');
            if (await fs.pathExists(uploadsBackupDir)) {
                await fs.copy(uploadsBackupDir, path.join(projectDir, 'uploads'));
            }
        }

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Run upgrade
 */
export async function runUpgrade(
    projectDir: string,
    dbConfig: DatabaseConfig,
    options: {
        targetVersion?: string;
        createBackup?: boolean;
        onProgress?: (message: string) => void;
    } = {}
): Promise<UpgradeResult> {
    const { targetVersion, createBackup: shouldBackup = true, onProgress } = options;

    const fromVersion = getCurrentVersion(projectDir);
    const toVersion = targetVersion || await getLatestVersion();

    const result: UpgradeResult = {
        success: false,
        fromVersion,
        toVersion,
        migrationsRun: 0,
    };

    // Check if upgrade is needed
    if (compareVersions(fromVersion, toVersion) >= 0) {
        result.success = true;
        return result;
    }

    try {
        // 1. Create backup
        if (shouldBackup) {
            onProgress?.('Creating backup before upgrade...');
            const backupResult = await createBackup(projectDir, dbConfig);
            if (!backupResult.success) {
                throw new Error(`Backup failed: ${backupResult.error}`);
            }
            result.backupPath = backupResult.backupPath;
        }

        // 2. Download new version
        onProgress?.(`Downloading version ${toVersion}...`);
        execSync(
            `curl -fsSL "https://github.com/jiffoo/mall/releases/download/v${toVersion}/jiffoo-mall.tar.gz" -o /tmp/jiffoo-upgrade.tar.gz`,
            { cwd: projectDir }
        );

        // 3. Extract and update files (excluding user data)
        onProgress?.('Extracting update...');
        execSync(
            'tar -xzf /tmp/jiffoo-upgrade.tar.gz --strip-components=1 --exclude=".env" --exclude="uploads" --exclude="backups"',
            { cwd: projectDir }
        );

        // 4. Install dependencies
        onProgress?.('Installing dependencies...');
        execSync('pnpm install --frozen-lockfile', {
            cwd: projectDir,
            stdio: 'pipe',
        });

        // 5. Run database migrations
        onProgress?.('Running database migrations...');
        const migrationOutput = execSync('pnpm run prisma:migrate:deploy 2>&1', {
            cwd: projectDir,
            encoding: 'utf-8',
        });

        // Count migrations run
        const migrationMatch = migrationOutput.match(/applied (\d+) migration/i);
        if (migrationMatch) {
            result.migrationsRun = parseInt(migrationMatch[1], 10);
        }

        // 6. Rebuild application
        onProgress?.('Rebuilding application...');
        execSync('pnpm run build', {
            cwd: projectDir,
            stdio: 'pipe',
        });

        // 7. Restart services
        onProgress?.('Restarting services...');
        execSync('pm2 restart all', { cwd: projectDir, stdio: 'pipe' });

        // 8. Cleanup
        await fs.remove('/tmp/jiffoo-upgrade.tar.gz');

        result.success = true;
        onProgress?.(`Upgrade to ${toVersion} completed successfully!`);
    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
}

/**
 * Rollback to previous version using backup
 */
export async function rollback(
    backupPath: string,
    projectDir: string,
    dbConfig: DatabaseConfig,
    onProgress?: (message: string) => void
): Promise<{ success: boolean; error?: string }> {
    try {
        onProgress?.('Starting rollback...');

        // Verify backup exists
        if (!await fs.pathExists(backupPath)) {
            throw new Error(`Backup not found: ${backupPath}`);
        }

        // Stop services
        onProgress?.('Stopping services...');
        execSync('pm2 stop all', { cwd: projectDir, stdio: 'pipe' });

        // Restore from backup
        onProgress?.('Restoring from backup...');
        const restoreResult = await restoreFromBackup(backupPath, projectDir, dbConfig);

        if (!restoreResult.success) {
            throw new Error(`Restore failed: ${restoreResult.error}`);
        }

        // Reinstall dependencies
        onProgress?.('Reinstalling dependencies...');
        execSync('pnpm install --frozen-lockfile', {
            cwd: projectDir,
            stdio: 'pipe',
        });

        // Restart services
        onProgress?.('Restarting services...');
        execSync('pm2 restart all', { cwd: projectDir, stdio: 'pipe' });

        onProgress?.('Rollback completed successfully!');
        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Export shop data for migration
 */
export async function exportData(
    projectDir: string,
    dbConfig: DatabaseConfig,
    outputPath: string,
    options: {
        includeProducts?: boolean;
        includeOrders?: boolean;
        includeUsers?: boolean;
        includeSettings?: boolean;
    } = {}
): Promise<{ success: boolean; error?: string }> {
    const {
        includeProducts = true,
        includeOrders = true,
        includeUsers = true,
        includeSettings = true,
    } = options;

    try {
        // This would use Prisma to export data as JSON
        const exportData: Record<string, unknown[]> = {};

        // For now, create a placeholder export structure
        // In production, this would query the database
        const manifest = {
            version: getCurrentVersion(projectDir),
            timestamp: new Date().toISOString(),
            includes: {
                products: includeProducts,
                orders: includeOrders,
                users: includeUsers,
                settings: includeSettings,
            },
        };

        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeJson(outputPath, { manifest, data: exportData }, { spaces: 2 });

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * List available backups
 */
export async function listBackups(
    projectDir: string
): Promise<{ path: string; timestamp: Date; size: number; version: string }[]> {
    const backupsDir = path.join(projectDir, 'backups');

    if (!await fs.pathExists(backupsDir)) {
        return [];
    }

    const items = await fs.readdir(backupsDir, { withFileTypes: true });
    const backups: { path: string; timestamp: Date; size: number; version: string }[] = [];

    for (const item of items) {
        if (item.isDirectory() && item.name.startsWith('backup-')) {
            const backupPath = path.join(backupsDir, item.name);
            const manifestPath = path.join(backupPath, 'manifest.json');

            if (await fs.pathExists(manifestPath)) {
                const manifest = await fs.readJson(manifestPath);
                const size = await getDirSize(backupPath);

                backups.push({
                    path: backupPath,
                    timestamp: new Date(manifest.timestamp),
                    size,
                    version: manifest.version,
                });
            }
        }
    }

    // Sort by timestamp descending
    backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return backups;
}

/**
 * Jiffoo Mall Installer - Main Entry Point
 * 
 * Exports all installer functionality
 */

// Types
export * from './types.js';

// Environment Detection
export {
    checkEnvironment,
    getOSInfo,
    getNodeInfo,
    getMemoryInfo,
    getDiskInfo,
    getDockerInfo,
    isPortAvailable,
    formatBytes,
    getEnvironmentSummary,
} from './environment.js';

// Configuration Generation
export {
    generateJwtSecret,
    generateRandomPassword,
    buildDatabaseUrl,
    buildRedisUrl,
    generateEnvContent,
    generateDockerComposeContent,
    generatePm2Config,
    generateNginxConfig,
    writeConfigFiles,
} from './config-generator.js';

// Database
export {
    testDatabaseConnection,
    createDatabase,
    runMigrations,
    seedDatabase,
    initializeDatabase,
    getDatabaseErrorSuggestion,
} from './database.js';

// Upgrade and Migration
export {
    getCurrentVersion,
    getLatestVersion,
    compareVersions,
    createBackup,
    restoreFromBackup,
    runUpgrade,
    rollback,
    exportData,
    listBackups,
    type BackupResult,
    type UpgradeResult,
} from './upgrade.js';

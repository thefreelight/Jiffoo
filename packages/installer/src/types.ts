/**
 * Jiffoo Mall Installer - Core Types
 * 
 * Type definitions for the installation system
 */

/**
 * Database configuration
 */
export interface DatabaseConfig {
    type: 'postgresql' | 'mysql';
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
}

/**
 * Admin user configuration
 */
export interface AdminConfig {
    email: string;
    password: string;
    name: string;
}

/**
 * Site configuration
 */
export interface SiteConfig {
    name: string;
    url: string;
    locale: string;
    timezone: string;
    description?: string;
}

/**
 * Service ports configuration
 */
export interface ServicesConfig {
    apiPort: number;
    shopPort: number;
    adminPort: number;
    superAdminPort: number;
}

/**
 * Redis configuration
 */
export interface RedisConfig {
    host: string;
    port: number;
    password?: string;
}

/**
 * Complete installation configuration
 */
export interface InstallConfig {
    database: DatabaseConfig;
    admin: AdminConfig;
    site: SiteConfig;
    services: ServicesConfig;
    redis: RedisConfig;
    jwtSecret: string;
}

/**
 * Operating system information
 */
export interface OSInfo {
    type: 'linux' | 'darwin' | 'win32' | 'unknown';
    platform: string;
    version: string;
    arch: string;
    distro?: string;
}

/**
 * Node.js environment check result
 */
export interface NodeInfo {
    version: string;
    majorVersion: number;
    satisfied: boolean;
    requiredVersion: string;
}

/**
 * Memory information
 */
export interface MemoryInfo {
    total: number;
    available: number;
    satisfied: boolean;
    requiredMinimum: number;
}

/**
 * Disk space information
 */
export interface DiskInfo {
    total: number;
    available: number;
    satisfied: boolean;
    requiredMinimum: number;
}

/**
 * Docker installation status
 */
export interface DockerInfo {
    installed: boolean;
    version?: string;
    composeInstalled: boolean;
    composeVersion?: string;
}

/**
 * Database connection check
 */
export interface DatabaseCheckInfo {
    reachable: boolean;
    canConnect: boolean;
    error?: string;
}

/**
 * Complete environment check result
 */
export interface EnvironmentCheckResult {
    os: OSInfo;
    node: NodeInfo;
    memory: MemoryInfo;
    disk: DiskInfo;
    docker: DockerInfo;
    database?: DatabaseCheckInfo;
    allSatisfied: boolean;
    timestamp: Date;
}

/**
 * Installation error types
 */
export enum InstallErrorType {
    ENVIRONMENT_CHECK_FAILED = 'ENVIRONMENT_CHECK_FAILED',
    DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
    DATABASE_MIGRATION_FAILED = 'DATABASE_MIGRATION_FAILED',
    CONFIG_GENERATION_FAILED = 'CONFIG_GENERATION_FAILED',
    SERVICE_START_FAILED = 'SERVICE_START_FAILED',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    NETWORK_ERROR = 'NETWORK_ERROR',
    INVALID_CONFIG = 'INVALID_CONFIG',
    ALREADY_INSTALLED = 'ALREADY_INSTALLED',
}

/**
 * Installation error
 */
export interface InstallError {
    type: InstallErrorType;
    message: string;
    suggestion: string;
    details?: Record<string, unknown>;
}

/**
 * Installation step
 */
export interface InstallStep {
    id: string;
    name: string;
    description: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    error?: InstallError;
    startTime?: Date;
    endTime?: Date;
}

/**
 * Installation progress
 */
export interface InstallProgress {
    currentStep: number;
    totalSteps: number;
    steps: InstallStep[];
    overallStatus: 'pending' | 'running' | 'completed' | 'failed';
}

/**
 * Installation result
 */
export interface InstallResult {
    success: boolean;
    config?: InstallConfig;
    accessUrls?: {
        shop: string;
        admin: string;
        superAdmin: string;
        api: string;
    };
    adminCredentials?: {
        email: string;
        tempPassword?: string;
    };
    error?: InstallError;
    duration: number;
}

/**
 * Environment requirements
 */
export const REQUIREMENTS = {
    node: {
        minVersion: '18.0.0',
        recommendedVersion: '20.0.0',
    },
    memory: {
        minimum: 1 * 1024 * 1024 * 1024, // 1GB
        recommended: 2 * 1024 * 1024 * 1024, // 2GB
    },
    disk: {
        minimum: 5 * 1024 * 1024 * 1024, // 5GB
        recommended: 10 * 1024 * 1024 * 1024, // 10GB
    },
    ports: {
        api: 3001,
        shop: 3000,
        admin: 3003,
        superAdmin: 3002,
    },
} as const;

/**
 * Default configuration values
 */
export const DEFAULTS: Partial<InstallConfig> = {
    database: {
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        name: 'jiffoo_mall',
        user: 'postgres',
        password: '',
    },
    redis: {
        host: 'localhost',
        port: 6379,
    },
    services: {
        apiPort: 3001,
        shopPort: 3000,
        adminPort: 3003,
        superAdminPort: 3002,
    },
    site: {
        name: 'Jiffoo Mall',
        url: 'http://localhost:3000',
        locale: 'en',
        timezone: 'UTC',
    },
};

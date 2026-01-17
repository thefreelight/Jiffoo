/**
 * Jiffoo Mall Installer - Config Generator
 * 
 * Generates .env configuration files from installation config
 */

import fs from 'fs-extra';
import path from 'node:path';
import crypto from 'node:crypto';
import type { InstallConfig, DatabaseConfig, RedisConfig } from './types.js';

/**
 * Generate a random JWT secret
 */
export function generateJwtSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a random password
 */
export function generateRandomPassword(length = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  return password;
}

/**
 * Build DATABASE_URL from config
 */
export function buildDatabaseUrl(config: DatabaseConfig): string {
  const { type, user, password, host, port, name } = config;
  const encodedPassword = encodeURIComponent(password);
  return `${type}://${user}:${encodedPassword}@${host}:${port}/${name}`;
}

/**
 * Build REDIS_URL from config
 */
export function buildRedisUrl(config: RedisConfig): string {
  const { host, port, password } = config;
  if (password) {
    return `redis://:${encodeURIComponent(password)}@${host}:${port}`;
  }
  return `redis://${host}:${port}`;
}

/**
 * Generate .env file content
 */
export function generateEnvContent(config: InstallConfig): string {
  const lines: string[] = [
    '# ============================================',
    '# Jiffoo Mall Configuration',
    `# Generated: ${new Date().toISOString()}`,
    '# ============================================',
    '',
    '# Environment',
    'NODE_ENV=production',
    '',
    '# Database',
    `DATABASE_URL="${buildDatabaseUrl(config.database)}"`,
    '',
    '# Redis',
    `REDIS_URL="${buildRedisUrl(config.redis)}"`,
    '',
    '# Authentication',
    `JWT_SECRET="${config.jwtSecret}"`,
    '',
    '# Service Ports',
    `API_PORT=${config.services.apiPort}`,
    `SHOP_PORT=${config.services.shopPort}`,
    `ADMIN_PORT=${config.services.adminPort}`,
    ...((config as any).includeSuperAdmin !== false ? [`SUPER_ADMIN_PORT=${config.services.superAdminPort}`] : []),
    '',
    '# Site Configuration',
    `SITE_NAME="${config.site.name}"`,
    `SITE_URL="${config.site.url}"`,
    `DEFAULT_LOCALE="${config.site.locale}"`,
    `TIMEZONE="${config.site.timezone}"`,
    '',
    '# API Configuration',
    `NEXT_PUBLIC_API_URL="${config.site.url.replace(/:\d+$/, '')}:${config.services.apiPort}"`,
    '',
    '# File Upload',
    'UPLOAD_MAX_SIZE=10485760',
    'UPLOAD_DIR=./uploads',
    '',
    '# Security',
    'CORS_ORIGIN=*',
    'RATE_LIMIT_WINDOW=60000',
    'RATE_LIMIT_MAX=100',
    '',
    '# Logging',
    'LOG_LEVEL=info',
    'LOG_FORMAT=json',
    '',
  ];

  return lines.join('\n');
}

/**
 * Generate docker-compose.yml content
 */
export function generateDockerComposeContent(config: InstallConfig): string {
  return `version: '3.8'

services:
  api:
    image: jiffoo/mall-api:latest
    container_name: jiffoo-api
    restart: unless-stopped
    ports:
      - "${config.services.apiPort}:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${buildDatabaseUrl(config.database)}
      - REDIS_URL=${buildRedisUrl(config.redis)}
      - JWT_SECRET=${config.jwtSecret}
    depends_on:
      - db
      - redis
    networks:
      - jiffoo

  shop:
    image: jiffoo/mall-shop:latest
    container_name: jiffoo-shop
    restart: unless-stopped
    ports:
      - "${config.services.shopPort}:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:3001
    depends_on:
      - api
    networks:
      - jiffoo

  admin:
    image: jiffoo/mall-admin:latest
    container_name: jiffoo-admin
    restart: unless-stopped
    ports:
      - "${config.services.adminPort}:3003"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:3001
    depends_on:
      - api
    networks:
      - jiffoo

  # Include super-admin only if available in the distribution
  ${(config as any).includeSuperAdmin !== false ? `
  super-admin:
    image: jiffoo/mall-super-admin:latest
    container_name: jiffoo-super-admin
    restart: unless-stopped
    ports:
      - "${config.services.superAdminPort}:3002"
    environment:
      - NEXT_PUBLIC_API_URL=http://api:3001
    depends_on:
      - api
    networks:
      - jiffoo
  ` : ''}

  db:
    image: postgres:15-alpine
    container_name: jiffoo-db
    restart: unless-stopped
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=${config.database.user}
      - POSTGRES_PASSWORD=${config.database.password}
      - POSTGRES_DB=${config.database.name}
    networks:
      - jiffoo

  redis:
    image: redis:7-alpine
    container_name: jiffoo-redis
    restart: unless-stopped
    volumes:
      - redisdata:/data
    networks:
      - jiffoo

networks:
  jiffoo:
    driver: bridge

volumes:
  pgdata:
  redisdata:
`;
}

/**
 * Generate PM2 ecosystem config
 */
export function generatePm2Config(config: InstallConfig, installDir: string): string {
  return `module.exports = {
  apps: [
    {
      name: 'jiffoo-api',
      cwd: '${installDir}/apps/api',
      script: 'dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: ${config.services.apiPort}
      }
    },
    {
      name: 'jiffoo-shop',
      cwd: '${installDir}/apps/shop',
      script: 'node_modules/.bin/next',
      args: 'start -p ${config.services.shopPort}',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'jiffoo-admin',
      cwd: '${installDir}/apps/admin',
      script: 'node_modules/.bin/next',
      args: 'start -p ${config.services.adminPort}',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      }
    }${(config as any).includeSuperAdmin !== false ? `,
    {
      name: 'jiffoo-super-admin',
      cwd: '${installDir}/apps/super-admin',
      script: 'node_modules/.bin/next',
      args: 'start -p ${config.services.superAdminPort}',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      }
    }` : ''}
  ]
};
`;
}

/**
 * Generate Nginx configuration
 */
export function generateNginxConfig(config: InstallConfig, domain: string): string {
  return `# Jiffoo Mall Nginx Configuration
# Generated: ${new Date().toISOString()}

upstream jiffoo_api {
    server 127.0.0.1:${config.services.apiPort};
}

upstream jiffoo_shop {
    server 127.0.0.1:${config.services.shopPort};
}

upstream jiffoo_admin {
    server 127.0.0.1:${config.services.adminPort};
}

upstream jiffoo_super_admin {
    server 127.0.0.1:${config.services.superAdminPort};
}

# Main shop
server {
    listen 80;
    server_name ${domain};
    
    # Force HTTPS (uncomment when SSL is configured)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://jiffoo_shop;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://jiffoo_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Admin panel
server {
    listen 80;
    server_name admin.${domain};

    location / {
        proxy_pass http://jiffoo_admin;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}

${(config as any).includeSuperAdmin !== false ? `
# Super Admin panel
server {
    listen 80;
    server_name superadmin.${domain};

    location / {
        proxy_pass http://jiffoo_super_admin;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
` : ''}
`;
}

/**
 * Write configuration files to disk
 */
export async function writeConfigFiles(
  config: InstallConfig,
  targetDir: string,
  options: {
    writeEnv?: boolean;
    writeDockerCompose?: boolean;
    writePm2Config?: boolean;
    writeNginxConfig?: boolean;
    domain?: string;
  } = {}
): Promise<void> {
  const {
    writeEnv = true,
    writeDockerCompose = false,
    writePm2Config = false,
    writeNginxConfig = false,
    domain = 'localhost',
  } = options;

  await fs.ensureDir(targetDir);

  if (writeEnv) {
    const envContent = generateEnvContent(config);
    await fs.writeFile(path.join(targetDir, '.env'), envContent, {
      mode: 0o600, // Secure permissions
    });
  }

  if (writeDockerCompose) {
    const dockerContent = generateDockerComposeContent(config);
    await fs.writeFile(path.join(targetDir, 'docker-compose.yml'), dockerContent);
  }

  if (writePm2Config) {
    const pm2Content = generatePm2Config(config, targetDir);
    await fs.writeFile(path.join(targetDir, 'ecosystem.config.js'), pm2Content);
  }

  if (writeNginxConfig) {
    await fs.ensureDir(path.join(targetDir, 'config'));
    const nginxContent = generateNginxConfig(config, domain);
    await fs.writeFile(path.join(targetDir, 'config', 'nginx.conf'), nginxContent);
  }
}

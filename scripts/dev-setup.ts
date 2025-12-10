#!/usr/bin/env npx tsx
/**
 * Development Environment Setup Script
 * 
 * This script automates the setup of the development environment:
 * 1. Checks if Docker is running
 * 2. Starts required Docker containers (postgres, redis)
 * 3. Waits for services to be ready
 * 4. Runs Prisma migrations
 * 5. Seeds the database with initial data
 * 
 * Usage: pnpm dev:setup
 */

import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

const ROOT_DIR = resolve(__dirname, '..');
const API_DIR = resolve(ROOT_DIR, 'apps/api');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command: string, cwd: string = ROOT_DIR): string {
  try {
    return execSync(command, { cwd, encoding: 'utf-8', stdio: 'pipe' });
  } catch (error: any) {
    throw new Error(error.stderr || error.message);
  }
}

async function checkDocker(): Promise<boolean> {
  log('\n🐳 Checking Docker...', 'blue');
  try {
    exec('docker info');
    log('✅ Docker is running', 'green');
    return true;
  } catch {
    log('❌ Docker is not running. Please start Docker Desktop.', 'red');
    return false;
  }
}

async function checkLocalPostgres(): Promise<void> {
  log('\n🔍 Checking for local PostgreSQL conflicts...', 'blue');
  try {
    const result = exec('lsof -i :5432 2>/dev/null || true');
    if (result.includes('postgres') && !result.includes('docker')) {
      log('⚠️  Local PostgreSQL detected on port 5432!', 'yellow');
      log('   Run: brew services stop postgresql@14', 'yellow');
      log('   Or:  brew services stop postgresql', 'yellow');
      throw new Error('Local PostgreSQL conflicts with Docker. Please stop it first.');
    }
    log('✅ No local PostgreSQL conflicts', 'green');
  } catch (error: any) {
    if (error.message.includes('conflicts')) throw error;
    // lsof not found or no results is fine
  }
}

async function startDockerServices(): Promise<void> {
  log('\n🚀 Starting Docker services...', 'blue');
  exec('docker compose up -d postgres redis');
  log('✅ Docker services started', 'green');
}

async function waitForPostgres(maxRetries = 30): Promise<void> {
  log('\n⏳ Waiting for PostgreSQL to be ready...', 'blue');
  for (let i = 0; i < maxRetries; i++) {
    try {
      exec('docker exec jiffoo-postgres pg_isready -U postgres');
      log('✅ PostgreSQL is ready', 'green');
      return;
    } catch {
      process.stdout.write('.');
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('PostgreSQL failed to start within timeout');
}

async function runMigrations(): Promise<void> {
  log('\n📦 Running Prisma migrations...', 'blue');
  exec('pnpm prisma migrate deploy', API_DIR);
  log('✅ Migrations completed', 'green');
}

async function seedDatabase(): Promise<void> {
  log('\n🌱 Seeding database...', 'blue');
  exec('pnpm prisma db seed', API_DIR);
  log('✅ Database seeded', 'green');
}

async function main() {
  log('╔════════════════════════════════════════╗', 'cyan');
  log('║   Jiffoo Mall Development Setup        ║', 'cyan');
  log('╚════════════════════════════════════════╝', 'cyan');

  try {
    // Check prerequisites
    if (!(await checkDocker())) process.exit(1);
    await checkLocalPostgres();
    
    // Start services
    await startDockerServices();
    await waitForPostgres();
    
    // Setup database
    await runMigrations();
    await seedDatabase();
    
    log('\n╔════════════════════════════════════════╗', 'green');
    log('║   ✅ Development environment ready!    ║', 'green');
    log('╚════════════════════════════════════════╝', 'green');
    log('\n📋 Test Accounts:', 'cyan');
    log('   Super Admin: admin@jiffoo.com / admin123', 'reset');
    log('   Tenant Admin: tenant@jiffoo.com / admin123', 'reset');
    log('   Sample User: user@jiffoo.com / admin123', 'reset');
    log('\n🚀 Start development:', 'cyan');
    log('   pnpm dev', 'reset');
    
  } catch (error: any) {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();


import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import type { FullConfig } from '@playwright/test';

const E2E_ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'e2e-admin@jiffoo.local';
const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'E2EAdmin123!';
const E2E_ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME || 'e2e-admin';
const E2E_SHOP_EMAIL = process.env.E2E_SHOP_EMAIL || 'e2e-shop-user@jiffoo.local';
const E2E_SHOP_PASSWORD = process.env.E2E_SHOP_PASSWORD || 'E2EShop123!';
const E2E_SHOP_USERNAME = process.env.E2E_SHOP_USERNAME || 'e2e-shop-user';

function loadEnvFiles() {
  const envCandidates = [
    path.resolve(__dirname, '../../.env.test'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../../../../.env'),
  ];

  for (const envFile of envCandidates) {
    dotenv.config({ path: envFile, override: false });
  }
}

function resolveSafeTestDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL_TEST;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL_TEST is required for E2E setup.');
  }

  if (!/(^|[_-])test([^a-zA-Z0-9]|$)/i.test(databaseUrl)) {
    throw new Error(`Unsafe database URL for E2E setup: ${databaseUrl}`);
  }

  process.env.DATABASE_URL_TEST = databaseUrl;
  process.env.DATABASE_URL = databaseUrl;
  return databaseUrl;
}

async function ensureAdminUser(prisma: PrismaClient) {
  const hashedPassword = await bcrypt.hash(E2E_ADMIN_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: E2E_ADMIN_EMAIL },
    update: {
      username: E2E_ADMIN_USERNAME,
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      email: E2E_ADMIN_EMAIL,
      username: E2E_ADMIN_USERNAME,
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });
}

async function ensureShopUser(prisma: PrismaClient) {
  const hashedPassword = await bcrypt.hash(E2E_SHOP_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: E2E_SHOP_EMAIL },
    update: {
      username: E2E_SHOP_USERNAME,
      password: hashedPassword,
      role: 'USER',
      isActive: true,
    },
    create: {
      email: E2E_SHOP_EMAIL,
      username: E2E_SHOP_USERNAME,
      password: hashedPassword,
      role: 'USER',
      isActive: true,
    },
  });
}

async function ensureDefaultStore(prisma: PrismaClient) {
  return prisma.store.upsert({
    where: { slug: 'e2e-default-store' },
    update: {
      name: 'E2E Default Store',
      status: 'active',
      currency: 'USD',
      defaultLocale: 'en',
    },
    create: {
      id: 'e2e-default-store',
      name: 'E2E Default Store',
      slug: 'e2e-default-store',
      status: 'active',
      currency: 'USD',
      defaultLocale: 'en',
    },
  });
}

function resolveExtensionsRoot(): string {
  const configured = process.env.EXTENSIONS_PATH || 'extensions';
  if (path.isAbsolute(configured)) return configured;
  return path.resolve(__dirname, '../../../../../', configured);
}

async function ensureE2EThemeFixtures(): Promise<void> {
  const extensionsRoots = Array.from(
    new Set([
      resolveExtensionsRoot(),
      path.resolve(__dirname, '../../../extensions'),
    ])
  );

  const shopThemeManifest = {
    slug: 'e2e-shop-theme',
    name: 'E2E Shop Theme',
    version: '1.0.0',
    description: 'Playwright E2E seeded theme',
    author: 'E2E',
    category: 'general',
    previewImage: '',
  };

  const adminThemeManifest = {
    slug: 'e2e-admin-theme',
    name: 'E2E Admin Theme',
    version: '1.0.0',
    description: 'Playwright E2E seeded admin theme',
    author: 'E2E',
    category: 'admin',
    previewImage: '',
  };

  for (const root of extensionsRoots) {
    const shopThemeDir = path.join(root, 'themes', 'shop', 'e2e-shop-theme');
    const adminThemeDir = path.join(root, 'themes', 'admin', 'e2e-admin-theme');
    await fs.mkdir(shopThemeDir, { recursive: true });
    await fs.mkdir(adminThemeDir, { recursive: true });
    await fs.writeFile(path.join(shopThemeDir, 'theme.json'), JSON.stringify(shopThemeManifest, null, 2), 'utf-8');
    await fs.writeFile(path.join(adminThemeDir, 'theme.json'), JSON.stringify(adminThemeManifest, null, 2), 'utf-8');
  }
}

async function ensureE2EPluginSeed(prisma: PrismaClient): Promise<void> {
  const pluginSlug = 'e2e-demo-plugin';
  await prisma.pluginInstall.upsert({
    where: { slug: pluginSlug },
    update: {
      name: 'E2E Demo Plugin',
      version: '1.0.0',
      description: 'Playwright seeded plugin package',
      category: 'general',
      runtimeType: 'external-http',
      externalBaseUrl: 'http://127.0.0.1:65535',
      source: 'builtin',
      installPath: null,
      permissions: [],
      deletedAt: null,
    },
    create: {
      slug: pluginSlug,
      name: 'E2E Demo Plugin',
      version: '1.0.0',
      description: 'Playwright seeded plugin package',
      category: 'general',
      runtimeType: 'external-http',
      externalBaseUrl: 'http://127.0.0.1:65535',
      source: 'builtin',
      installPath: null,
      permissions: [],
      deletedAt: null,
    },
  });

  await prisma.pluginInstallation.upsert({
    where: {
      pluginSlug_instanceKey: {
        pluginSlug,
        instanceKey: 'default',
      },
    },
    update: {
      enabled: true,
      configJson: { seededBy: 'playwright-e2e' },
      grantedPermissions: [],
      deletedAt: null,
    },
    create: {
      pluginSlug,
      instanceKey: 'default',
      enabled: true,
      configJson: { seededBy: 'playwright-e2e' },
      grantedPermissions: [],
      deletedAt: null,
    },
  });
}

async function ensureE2EOrderSeed(prisma: PrismaClient): Promise<void> {
  const existingOrders = await prisma.order.count();
  if (existingOrders > 0) return;

  const store = await ensureDefaultStore(prisma);

  const category = await prisma.category.upsert({
    where: { slug: 'e2e-seed-category' },
    update: { name: 'E2E Seed Category' },
    create: {
      slug: 'e2e-seed-category',
      name: 'E2E Seed Category',
      description: 'Seed category for admin e2e orders',
    },
  });

  const product = await prisma.product.upsert({
    where: { slug: 'e2e-seed-product' },
    update: {
      name: 'E2E Seed Product',
      description: 'Seed product for admin e2e orders',
      categoryId: category.id,
      storeId: store.id,
    },
    create: {
      slug: 'e2e-seed-product',
      name: 'E2E Seed Product',
      description: 'Seed product for admin e2e orders',
      categoryId: category.id,
      requiresShipping: true,
      productType: 'physical',
      storeId: store.id,
    },
  });

  const variant = await prisma.productVariant.upsert({
    where: { id: 'e2e-seed-variant' },
    update: {
      productId: product.id,
      name: 'Default',
      salePrice: 19.99,
      baseStock: 100,
      isActive: true,
    },
    create: {
      id: 'e2e-seed-variant',
      productId: product.id,
      name: 'Default',
      salePrice: 19.99,
      baseStock: 100,
      isActive: true,
      sortOrder: 0,
    },
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'E2E' },
    update: { isDefault: true },
    create: {
      id: 'e2e-warehouse',
      name: 'E2E Warehouse',
      code: 'E2E',
      isActive: true,
      isDefault: true,
    },
  });

  await prisma.warehouseInventory.upsert({
    where: {
      warehouseId_variantId: {
        warehouseId: warehouse.id,
        variantId: variant.id,
      },
    },
    update: {
      quantity: 100,
      reserved: 0,
      available: 100,
      lowStock: 10,
    },
    create: {
      warehouseId: warehouse.id,
      variantId: variant.id,
      quantity: 100,
      reserved: 0,
      available: 100,
      lowStock: 10,
    },
  });

  const admin = await prisma.user.findUnique({
    where: { email: E2E_ADMIN_EMAIL },
    select: { id: true, email: true },
  });
  if (!admin) return;

  const order = await prisma.order.create({
    data: {
      userId: admin.id,
      storeId: store.id,
      status: 'PENDING',
      paymentStatus: 'PAID',
      subtotalAmount: 19.99,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 19.99,
      customerEmail: admin.email,
    },
  });

  await prisma.orderItem.create({
    data: {
      orderId: order.id,
      productId: product.id,
      variantId: variant.id,
      quantity: 1,
      unitPrice: 19.99,
    },
  });
}

async function loginAndBuildStorageState(
  apiBaseUrl: string,
  appBaseUrl: string,
  email: string,
  password: string
) {
  let loginResponse: Response | null = null;
  let lastStatus = 0;
  const maxAttempts = 8;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    loginResponse = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (loginResponse.ok) {
      break;
    }

    lastStatus = loginResponse.status;
    if (lastStatus !== 429 || attempt === maxAttempts) {
      throw new Error(`Failed to login test user, status=${lastStatus}`);
    }

    const retryAfterHeader = loginResponse.headers.get('retry-after');
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : attempt * 1000;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  if (!loginResponse || !loginResponse.ok) {
    throw new Error(`Failed to login test user, status=${lastStatus || 'unknown'}`);
  }

  const loginBody = await loginResponse.json() as {
    success?: boolean;
    data?: { access_token?: string; refresh_token?: string };
  };

  const accessToken = loginBody?.data?.access_token;
  if (!accessToken) {
    throw new Error('Missing access_token in login response for E2E user');
  }

  const localStorageState: Array<{ name: string; value: string }> = [
    { name: 'auth_token', value: accessToken },
    { name: 'auth_status', value: 'authenticated' },
  ];

  if (loginBody?.data?.refresh_token) {
    localStorageState.push({ name: 'refresh_token', value: loginBody.data.refresh_token });
  }

  return {
    cookies: [],
    origins: [
      {
        origin: appBaseUrl,
        localStorage: localStorageState,
      },
    ],
  };
}

function getStorageStatePath(name: 'admin' | 'shop'): string {
  return path.resolve(__dirname, `../.auth/${name}-storage-state.json`);
}

async function writeStorageState(name: 'admin' | 'shop', storageState: unknown): Promise<void> {
  const storageStatePath = getStorageStatePath(name);
  await fs.mkdir(path.dirname(storageStatePath), { recursive: true });
  await fs.writeFile(storageStatePath, JSON.stringify(storageState, null, 2), 'utf-8');
}

export default async function globalSetup(config: FullConfig) {
  loadEnvFiles();
  const testDatabaseUrl = resolveSafeTestDatabaseUrl();

  const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:3001';
  const adminBaseUrl = process.env.E2E_ADMIN_BASE_URL || 'http://127.0.0.1:3002';
  const shopBaseUrl = process.env.E2E_SHOP_BASE_URL || 'http://127.0.0.1:3003';

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: testDatabaseUrl,
      },
    },
  });

  try {
    await prisma.$connect();
    await ensureAdminUser(prisma);
    await ensureShopUser(prisma);
    await ensureE2EPluginSeed(prisma);
    await ensureE2EOrderSeed(prisma);
  } finally {
    await prisma.$disconnect();
  }

  await ensureE2EThemeFixtures();

  const adminStorageState = await loginAndBuildStorageState(
    apiBaseUrl,
    adminBaseUrl,
    E2E_ADMIN_EMAIL,
    E2E_ADMIN_PASSWORD
  );
  await writeStorageState('admin', adminStorageState);

  const shopStorageState = await loginAndBuildStorageState(
    apiBaseUrl,
    shopBaseUrl,
    E2E_SHOP_EMAIL,
    E2E_SHOP_PASSWORD
  );
  await writeStorageState('shop', shopStorageState);

  if (!config.projects.length) {
    throw new Error('No Playwright projects configured');
  }
}

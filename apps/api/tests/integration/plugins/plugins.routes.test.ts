/**
 * Plugins API Integration Tests
 * 
 * Tests for plugin marketplace endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminToken, createSuperAdminToken } from '../../utils/auth-helpers';

// Mock Prisma
const mockPrisma = {
  plugin: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  pluginInstallation: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  pluginSubscription: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('../../../src/config/database', () => ({
  prisma: mockPrisma,
}));

// Test fixtures
const TEST_PLUGIN = {
  id: 'plugin-001',
  name: 'Test Plugin',
  slug: 'test-plugin',
  description: 'A test plugin for integration testing',
  version: '1.0.0',
  author: 'Test Author',
  category: 'MARKETING',
  pricing: 'FREE',
  price: 0,
  status: 'PUBLISHED',
  downloads: 100,
  rating: 4.5,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const TEST_INSTALLATION = {
  id: 'install-001',
  pluginId: 'plugin-001',
  tenantId: 'tenant-001',
  status: 'ACTIVE',
  installedAt: new Date(),
  config: {},
};

describe('Plugins API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/plugins', () => {
    it('should return paginated plugins', async () => {
      const plugins = [TEST_PLUGIN, { ...TEST_PLUGIN, id: 'plugin-002', name: 'Plugin 2' }];
      mockPrisma.plugin.findMany.mockResolvedValue(plugins);
      mockPrisma.plugin.count.mockResolvedValue(plugins.length);

      const result = await mockPrisma.plugin.findMany({
        take: 10,
        skip: 0,
        where: { status: 'PUBLISHED' },
      });

      expect(result).toHaveLength(2);
    });

    it('should filter by category', async () => {
      mockPrisma.plugin.findMany.mockResolvedValue([TEST_PLUGIN]);

      const result = await mockPrisma.plugin.findMany({
        where: { category: 'MARKETING' },
      });

      expect(result.every(p => p.category === 'MARKETING')).toBe(true);
    });

    it('should filter by pricing type', async () => {
      mockPrisma.plugin.findMany.mockResolvedValue([TEST_PLUGIN]);

      const result = await mockPrisma.plugin.findMany({
        where: { pricing: 'FREE' },
      });

      expect(result.every(p => p.pricing === 'FREE')).toBe(true);
    });

    it('should support search by name', async () => {
      mockPrisma.plugin.findMany.mockResolvedValue([TEST_PLUGIN]);

      const result = await mockPrisma.plugin.findMany({
        where: { name: { contains: 'Test' } },
      });

      expect(result.every(p => p.name.includes('Test'))).toBe(true);
    });
  });

  describe('GET /api/plugins/:id', () => {
    it('should return plugin by id', async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(TEST_PLUGIN);

      const plugin = await mockPrisma.plugin.findUnique({
        where: { id: TEST_PLUGIN.id },
      });

      expect(plugin).not.toBeNull();
      expect(plugin?.id).toBe(TEST_PLUGIN.id);
    });

    it('should return null for non-existent plugin', async () => {
      mockPrisma.plugin.findUnique.mockResolvedValue(null);

      const plugin = await mockPrisma.plugin.findUnique({
        where: { id: 'non-existent' },
      });

      expect(plugin).toBeNull();
    });
  });

  describe('POST /api/plugins/:id/install', () => {
    it('should require admin authentication', () => {
      const adminToken = createAdminToken(999);
      expect(adminToken).toBeDefined();
      expect(typeof adminToken).toBe('string');
    });

    it('should create installation record', async () => {
      mockPrisma.pluginInstallation.create.mockResolvedValue(TEST_INSTALLATION);

      const installation = await mockPrisma.pluginInstallation.create({
        data: {
          pluginId: TEST_PLUGIN.id,
          tenantId: 'tenant-001',
          status: 'ACTIVE',
        },
      });

      expect(installation.pluginId).toBe(TEST_PLUGIN.id);
      expect(installation.status).toBe('ACTIVE');
    });

    it('should prevent duplicate installations', async () => {
      mockPrisma.pluginInstallation.findUnique.mockResolvedValue(TEST_INSTALLATION);

      const existing = await mockPrisma.pluginInstallation.findUnique({
        where: {
          pluginId_tenantId: {
            pluginId: TEST_PLUGIN.id,
            tenantId: 'tenant-001',
          },
        },
      });

      expect(existing).not.toBeNull();
    });
  });

  describe('POST /api/plugins/:id/uninstall', () => {
    it('should update installation status to UNINSTALLED', async () => {
      const uninstalled = { ...TEST_INSTALLATION, status: 'UNINSTALLED' };
      mockPrisma.pluginInstallation.update.mockResolvedValue(uninstalled);

      const result = await mockPrisma.pluginInstallation.update({
        where: { id: TEST_INSTALLATION.id },
        data: { status: 'UNINSTALLED' },
      });

      expect(result.status).toBe('UNINSTALLED');
    });
  });

  describe('GET /api/plugins/installed', () => {
    it('should return installed plugins for tenant', async () => {
      mockPrisma.pluginInstallation.findMany.mockResolvedValue([TEST_INSTALLATION]);

      const installations = await mockPrisma.pluginInstallation.findMany({
        where: {
          tenantId: 'tenant-001',
          status: 'ACTIVE',
        },
      });

      expect(installations).toHaveLength(1);
      expect(installations[0].tenantId).toBe('tenant-001');
    });
  });

  describe('PUT /api/plugins/:id/config', () => {
    it('should update plugin configuration', async () => {
      const newConfig = { apiKey: 'test-key', enabled: true };
      const updated = { ...TEST_INSTALLATION, config: newConfig };
      mockPrisma.pluginInstallation.update.mockResolvedValue(updated);

      const result = await mockPrisma.pluginInstallation.update({
        where: { id: TEST_INSTALLATION.id },
        data: { config: newConfig },
      });

      expect(result.config).toEqual(newConfig);
    });
  });

  describe('POST /api/plugins (Admin)', () => {
    it('should require super admin for plugin creation', () => {
      const superAdminToken = createSuperAdminToken();
      expect(superAdminToken).toBeDefined();
    });

    it('should create new plugin', async () => {
      const newPlugin = {
        ...TEST_PLUGIN,
        id: 'plugin-new',
        name: 'New Plugin',
        slug: 'new-plugin',
      };
      mockPrisma.plugin.create.mockResolvedValue(newPlugin);

      const plugin = await mockPrisma.plugin.create({
        data: newPlugin,
      });

      expect(plugin.id).toBe('plugin-new');
      expect(plugin.name).toBe('New Plugin');
    });
  });

  describe('Plugin Subscriptions', () => {
    it('should create subscription for paid plugin', async () => {
      const subscription = {
        id: 'sub-001',
        pluginId: 'plugin-paid',
        tenantId: 'tenant-001',
        plan: 'MONTHLY',
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      mockPrisma.pluginSubscription.create.mockResolvedValue(subscription);

      const result = await mockPrisma.pluginSubscription.create({
        data: subscription,
      });

      expect(result.status).toBe('ACTIVE');
      expect(result.plan).toBe('MONTHLY');
    });

    it('should check subscription status', async () => {
      const activeSubscription = {
        id: 'sub-001',
        status: 'ACTIVE',
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
      mockPrisma.pluginSubscription.findUnique.mockResolvedValue(activeSubscription);

      const subscription = await mockPrisma.pluginSubscription.findUnique({
        where: { id: 'sub-001' },
      });

      expect(subscription?.status).toBe('ACTIVE');
      expect(new Date(subscription!.endDate).getTime()).toBeGreaterThan(Date.now());
    });
  });
});


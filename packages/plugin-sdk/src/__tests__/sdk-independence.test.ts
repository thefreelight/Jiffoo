/**
 * Property Test: SDK Independence
 * 
 * Feature: developer-ecosystem, Property 1: SDK Independence
 * Validates: Requirements 1.3, 2.1, 2.2
 * 
 * For any plugin or theme project, building with only @jiffoo/plugin-sdk
 * or @jiffoo/theme-sdk (without core repository access) SHALL produce
 * a valid, installable package.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  definePlugin,
  createRoute,
  createHook,
  validateManifest,
  SDK_VERSION,
  PLATFORM_COMPATIBILITY,
} from '../index';
import type { PluginConfig, PluginManifest } from '../types';

// Arbitrary generators for plugin configuration
const pluginSlugArb = fc.stringMatching(/^[a-z][a-z0-9-]{2,29}$/);
const pluginNameArb = fc.string({ minLength: 1, maxLength: 100 });
const pluginVersionArb = fc.stringMatching(/^\d+\.\d+\.\d+$/);
const pluginCategoryArb = fc.constantFrom(
  'payment',
  'email',
  'integration',
  'theme',
  'analytics',
  'marketing',
  'shipping',
  'seo',
  'social',
  'security',
  'other'
);
const pluginCapabilityArb = fc.constantFrom(
  'payment.process',
  'payment.refund',
  'email.send',
  'email.template',
  'auth.oauth',
  'auth.sso',
  'webhook.receive',
  'webhook.send',
  'storage.upload',
  'storage.download',
  'analytics.track',
  'analytics.report',
  'shipping.calculate',
  'shipping.track',
  'seo.sitemap',
  'seo.meta',
  'social.share',
  'social.login'
);

const pluginConfigArb: fc.Arbitrary<PluginConfig> = fc.record({
  slug: pluginSlugArb,
  name: pluginNameArb,
  version: pluginVersionArb,
  description: fc.string({ minLength: 1, maxLength: 500 }),
  author: fc.string({ minLength: 1, maxLength: 100 }),
  category: pluginCategoryArb,
  capabilities: fc.array(pluginCapabilityArb, { minLength: 1, maxLength: 5 }),
});

describe('SDK Independence Property Tests', () => {
  /**
   * Property 1.1: definePlugin produces valid plugin definition
   * Any valid configuration should produce a plugin with all required fields
   */
  it('definePlugin produces valid plugin definition for any valid config', () => {
    fc.assert(
      fc.property(pluginConfigArb, (config) => {
        const plugin = definePlugin(config);
        const manifest = plugin.getManifest();
        
        // Plugin manifest should have all required fields
        expect(manifest.slug).toBe(config.slug);
        expect(manifest.name).toBe(config.name);
        expect(manifest.version).toBe(config.version);
        expect(manifest.category).toBe(config.category);
        expect(manifest.capabilities).toEqual(config.capabilities);
        
        // Plugin should have required methods
        expect(typeof plugin.addRoute).toBe('function');
        expect(typeof plugin.addHook).toBe('function');
        expect(typeof plugin.getManifest).toBe('function');
        expect(typeof plugin.getRoutes).toBe('function');
        expect(typeof plugin.getHooks).toBe('function');
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.2: createRoute produces valid route definition
   * Routes should be properly formatted and contain handler
   */
  it('createRoute produces valid route definition', () => {
    const pathArb = fc.stringMatching(/^\/[a-z0-9/-]*$/);
    const methodArb = fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH');
    
    fc.assert(
      fc.property(pathArb, methodArb, (path, method) => {
        const handler = async () => ({ success: true });
        const route = createRoute(path, handler, { method });
        
        expect(route.path).toBe(path);
        expect(route.method).toBe(method);
        expect(typeof route.handler).toBe('function');
        
        return true;
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 1.3: createHook produces valid hook definition
   * Hooks should be properly registered with event and handler
   */
  it('createHook produces valid hook definition', () => {
    const eventArb = fc.constantFrom(
      'order.created',
      'order.paid',
      'order.shipped',
      'product.created',
      'product.updated',
      'user.registered'
    );
    
    fc.assert(
      fc.property(eventArb, (event) => {
        const handler = async () => {};
        const hook = createHook(event, handler);
        
        expect(hook.event).toBe(event);
        expect(typeof hook.handler).toBe('function');
        
        return true;
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property 1.4: Plugin manifest validation is deterministic
   * Same input should always produce same validation result
   */
  it('manifest validation is deterministic', () => {
    const manifestArb: fc.Arbitrary<PluginManifest> = fc.record({
      slug: pluginSlugArb,
      name: pluginNameArb,
      version: pluginVersionArb,
      description: fc.string({ maxLength: 500 }),
      category: pluginCategoryArb,
      capabilities: fc.array(pluginCapabilityArb, { minLength: 1, maxLength: 5 }),
      author: fc.string({ minLength: 1, maxLength: 100 }),
      license: fc.constant('GPL-3.0'),
      homepage: fc.option(fc.webUrl(), { nil: undefined }),
      repository: fc.option(fc.webUrl(), { nil: undefined }),
      sdkVersion: fc.constant(SDK_VERSION),
      platformCompatibility: fc.constant(PLATFORM_COMPATIBILITY),
    });
    
    fc.assert(
      fc.property(manifestArb, (manifest) => {
        const result1 = validateManifest(manifest);
        const result2 = validateManifest(manifest);
        
        // Same input should produce same output
        expect(result1.valid).toBe(result2.valid);
        expect(result1.errors).toEqual(result2.errors);
        
        return true;
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 1.5: SDK exports are complete and accessible
   * All documented exports should be available
   */
  it('SDK exports all required functions and types', () => {
    // Core functions
    expect(typeof definePlugin).toBe('function');
    expect(typeof createRoute).toBe('function');
    expect(typeof createHook).toBe('function');
    expect(typeof validateManifest).toBe('function');
    
    // Constants
    expect(typeof SDK_VERSION).toBe('string');
    expect(typeof PLATFORM_COMPATIBILITY).toBe('string');
    
    // Version format
    expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

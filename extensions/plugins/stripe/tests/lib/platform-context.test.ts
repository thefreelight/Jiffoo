import { describe, expect, it, vi } from 'vitest';
import {
  getContext,
  getPluginConfig,
  createContextMiddleware,
} from '../../src/lib/platform-context';

// ============================================================================
// getContext
// ============================================================================

describe('getContext', () => {
  it('extracts all standard platform headers', () => {
    const ctx = getContext({
      'x-platform-id': 'plat_1',
      'x-plugin-slug': 'stripe',
      'x-installation-id': 'ins_1',
      'x-installation-key': 'key_abc',
      'x-user-id': 'user_1',
      'x-user-role': 'customer',
      'x-request-id': 'req_1',
      'x-locale': 'en-US',
      'x-caller': 'admin',
      'x-platform-api-base-url': 'http://localhost:3001/api',
      'x-platform-integration-token': 'token_abc',
    });

    expect(ctx).toEqual({
      platformId: 'plat_1',
      pluginSlug: 'stripe',
      installationId: 'ins_1',
      installationKey: 'key_abc',
      userId: 'user_1',
      userRole: 'customer',
      requestId: 'req_1',
      locale: 'en-US',
      caller: 'admin',
      platformApiBaseUrl: 'http://localhost:3001/api',
      platformIntegrationToken: 'token_abc',
    });
  });

  it('returns defaults for missing headers', () => {
    const ctx = getContext({});

    expect(ctx.platformId).toBe('');
    expect(ctx.pluginSlug).toBe('');
    // installationId defaults to 'default' when empty
    expect(ctx.installationId).toBe('default');
    expect(ctx.installationKey).toBe('');
  });

  it('returns undefined for optional fields when headers are missing', () => {
    const ctx = getContext({});

    expect(ctx.userId).toBeUndefined();
    expect(ctx.userRole).toBeUndefined();
    expect(ctx.requestId).toBeUndefined();
    expect(ctx.locale).toBeUndefined();
    expect(ctx.caller).toBeUndefined();
    expect(ctx.platformApiBaseUrl).toBeUndefined();
    expect(ctx.platformIntegrationToken).toBeUndefined();
  });

  it('handles array header values by taking the first element', () => {
    const ctx = getContext({
      'x-platform-id': ['plat_a', 'plat_b'],
      'x-user-id': ['user_a'],
    });

    expect(ctx.platformId).toBe('plat_a');
    expect(ctx.userId).toBe('user_a');
  });

  it('handles empty array header values', () => {
    const ctx = getContext({
      'x-platform-id': [],
    });

    expect(ctx.platformId).toBe('');
  });

  it('handles lowercase header names (Express normalizes to lowercase)', () => {
    const ctx = getContext({
      'x-platform-id': 'plat_lower',
      'x-user-id': 'user_lower',
    });

    expect(ctx.platformId).toBe('plat_lower');
    expect(ctx.userId).toBe('user_lower');
  });
});

// ============================================================================
// getPluginConfig
// ============================================================================

describe('getPluginConfig', () => {
  it('decodes base64url config header', () => {
    const config = {
      secretKey: 'sk_test_abc',
      publishableKey: 'pk_test_xyz',
      webhookSecret: 'whsec_123',
    };
    const encoded = Buffer.from(JSON.stringify(config)).toString('base64url');

    const result = getPluginConfig({ 'x-plugin-config': encoded });

    expect(result).toEqual(config);
  });

  it('returns empty object when header is missing', () => {
    const result = getPluginConfig({});

    expect(result).toEqual({});
  });

  it('returns empty object when header is empty string', () => {
    const result = getPluginConfig({ 'x-plugin-config': '' });

    expect(result).toEqual({});
  });

  it('returns empty object for invalid base64 content', () => {
    const result = getPluginConfig({ 'x-plugin-config': '!!!invalid!!!' });

    expect(result).toEqual({});
  });

  it('returns empty object for non-JSON base64 content', () => {
    const encoded = Buffer.from('not json').toString('base64url');
    const result = getPluginConfig({ 'x-plugin-config': encoded });

    expect(result).toEqual({});
  });

  it('handles partial config (only secretKey)', () => {
    const config = { secretKey: 'sk_test_only' };
    const encoded = Buffer.from(JSON.stringify(config)).toString('base64url');

    const result = getPluginConfig({ 'x-plugin-config': encoded });

    expect(result).toEqual({ secretKey: 'sk_test_only' });
  });
});

// ============================================================================
// createContextMiddleware
// ============================================================================

describe('createContextMiddleware', () => {
  it('attaches pluginContext and pluginConfig to request', () => {
    const middleware = createContextMiddleware();

    const config = { secretKey: 'sk_mw' };
    const encoded = Buffer.from(JSON.stringify(config)).toString('base64url');

    const req: any = {
      headers: {
        'x-platform-id': 'plat_mw',
        'x-plugin-slug': 'stripe',
        'x-installation-id': 'ins_mw',
        'x-installation-key': 'key_mw',
        'x-caller': 'admin',
        'x-plugin-config': encoded,
      },
    };
    const res: any = {};
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.pluginContext).toBeDefined();
    expect(req.pluginContext.platformId).toBe('plat_mw');
    expect(req.pluginContext.installationId).toBe('ins_mw');
    expect(req.pluginContext.caller).toBe('admin');
    expect(req.pluginConfig).toBeDefined();
    expect(req.pluginConfig.secretKey).toBe('sk_mw');
  });

  it('attaches defaults when no headers are present', () => {
    const middleware = createContextMiddleware();
    const req: any = { headers: {} };
    const res: any = {};
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.pluginContext.installationId).toBe('default');
    expect(req.pluginConfig).toEqual({});
  });
});

import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import stripePlugin from '../src/index';

const ENV_KEYS = [
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NODE_ENV',
];

let savedEnv: Record<string, string | undefined>;

function saveEnv() {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = savedEnv[key];
    }
  }
}

function setAllKeys() {
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_51Abc123XyzLong';
  process.env.STRIPE_SECRET_KEY = 'sk_test_secret_key_value';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';
  process.env.NODE_ENV = 'development';
}

describe('stripe internal-fastify runtime', () => {
  beforeEach(() => {
    saveEnv();
    setAllKeys();
  });
  afterEach(() => restoreEnv());

  it('exposes health endpoint through the internal-fastify entry', async () => {
    const app = Fastify();
    await app.register(stripePlugin as any);

    const health = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      status: 'healthy',
      plugin: 'stripe',
    });

    await app.close();
  });

  it('exposes manifest endpoint with correct plugin metadata', async () => {
    const app = Fastify();
    await app.register(stripePlugin as any);

    const manifest = await app.inject({
      method: 'GET',
      url: '/manifest',
    });
    expect(manifest.statusCode).toBe(200);
    const body = manifest.json();
    expect(body).toMatchObject({
      slug: 'stripe',
      runtimeType: 'internal-fastify',
    });
    expect(body.capabilities).toContain('payment.process');
    expect(body.capabilities).toContain('admin.panel');

    await app.close();
  });

  it('forwards gateway-style GET requests into the express app', async () => {
    const app = Fastify();
    await app.register(stripePlugin as any);

    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-platform-id': 'plat_1',
        'x-plugin-slug': 'stripe',
        'x-installation-id': 'ins_internal',
      },
    });
    expect(res.statusCode).toBe(200);

    await app.close();
  });

  it('GET /admin returns text/html content type', async () => {
    const app = Fastify();
    await app.register(stripePlugin as any);

    const res = await app.inject({
      method: 'GET',
      url: '/admin',
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');

    await app.close();
  });

  it('GET /admin/api/status returns success=true with data', async () => {
    const app = Fastify();
    await app.register(stripePlugin as any);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/status',
      headers: {
        'x-platform-id': 'plat_1',
        'x-plugin-slug': 'stripe',
        'x-installation-id': 'ins_admin',
        'x-caller': 'admin',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.plugin).toBe('stripe');

    await app.close();
  });

  it('has __lifecycle_onEnable that succeeds when keys are set', async () => {
    expect(typeof (stripePlugin as any).__lifecycle_onEnable).toBe('function');
    const result = await (stripePlugin as any).__lifecycle_onEnable();
    expect(result).toEqual({ success: true, message: 'Stripe plugin enabled' });
  });

  it('__lifecycle_onEnable throws when publishable key is missing', async () => {
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    await expect((stripePlugin as any).__lifecycle_onEnable()).rejects.toThrow(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required',
    );
  });

  it('__lifecycle_onEnable succeeds with config from LifecycleContext even without env vars', async () => {
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const context = {
      installationId: 'inst_ctx',
      pluginSlug: 'stripe',
      instanceKey: 'default',
      config: {
        publishableKey: 'pk_test_from_context',
        secretKey: 'sk_test_from_context',
        webhookSecret: 'whsec_from_context',
      },
    };
    const result = await (stripePlugin as any).__lifecycle_onEnable(context);
    expect(result).toEqual({ success: true, message: 'Stripe plugin enabled' });
  });

  // ==========================================================================
  // Lifecycle hooks: onInstall, onDisable, onUninstall
  // ==========================================================================

  it('has __lifecycle_onInstall that returns success', async () => {
    expect(typeof (stripePlugin as any).__lifecycle_onInstall).toBe('function');
    const result = await (stripePlugin as any).__lifecycle_onInstall();
    expect(result).toEqual({ success: true, message: 'Stripe plugin installed' });
  });

  it('has __lifecycle_onDisable that returns success', async () => {
    expect(typeof (stripePlugin as any).__lifecycle_onDisable).toBe('function');
    const result = await (stripePlugin as any).__lifecycle_onDisable();
    expect(result).toEqual({ success: true, message: 'Stripe plugin disabled' });
  });

  it('has __lifecycle_onUninstall that returns success', async () => {
    expect(typeof (stripePlugin as any).__lifecycle_onUninstall).toBe('function');
    const result = await (stripePlugin as any).__lifecycle_onUninstall();
    expect(result).toEqual({ success: true, message: 'Stripe plugin uninstalled' });
  });

  // ==========================================================================
  // Route accessibility through Fastify gateway
  // ==========================================================================

  it('payment API routes are accessible through Fastify gateway', async () => {
    const app = Fastify();
    await app.register(stripePlugin as any);

    const res = await app.inject({
      method: 'GET',
      url: '/api/methods',
      headers: {
        'x-platform-id': 'plat_1',
        'x-plugin-slug': 'stripe',
        'x-installation-id': 'ins_gw',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.methods).toBeDefined();

    await app.close();
  });

  it('webhook route is accessible through Fastify gateway', async () => {
    const app = Fastify();
    await app.register(stripePlugin as any);

    // POST without signature should return 400 (not 404)
    const res = await app.inject({
      method: 'POST',
      url: '/webhook',
      headers: {
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ type: 'test' }),
    });
    // 400 = route exists but signature is missing
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');

    await app.close();
  });

  it('manifest webhook path accepts platform lifecycle events through Fastify gateway', async () => {
    const app = Fastify();
    await app.register(stripePlugin as any);

    const res = await app.inject({
      method: 'POST',
      url: '/webhook/stripe',
      headers: {
        'content-type': 'application/json',
        'x-platform-id': 'plat_1',
        'x-plugin-slug': 'stripe',
        'x-installation-id': 'ins_webhook',
      },
      payload: JSON.stringify({
        id: 'evt_order_created',
        type: 'order.created',
        data: { orderId: 'order_123' },
      }),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      success: true,
      data: {
        ignored: true,
        eventType: 'order.created',
        reason: 'platform-lifecycle-event',
      },
    });

    await app.close();
  });

  it('admin dashboard route is accessible through Fastify gateway', async () => {
    const app = Fastify();
    await app.register(stripePlugin as any);

    // Without admin header, admin routes should return 403
    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/dashboard',
      headers: {
        'x-platform-id': 'plat_1',
        'x-plugin-slug': 'stripe',
        'x-installation-id': 'ins_gw',
        'x-caller': 'shop',
      },
    });
    // 403 = route exists but access is denied
    expect(res.statusCode).toBe(403);

    await app.close();
  });

  // ==========================================================================
  // Session API routes (core platform payment contract)
  // ==========================================================================

  it('POST /payments/create-session is routable (matches core gateway forwarded path)', async () => {
    const app = Fastify();
    await app.register(stripePlugin as any);

    // Core gateway forwards /payments/create-session to the plugin.
    // Without valid Stripe keys this will fail at Stripe API level, but
    // we can verify the route exists by checking it returns a non-404 status.
    const res = await app.inject({
      method: 'POST',
      url: '/payments/create-session',
      headers: {
        'x-platform-id': 'plat_1',
        'x-plugin-slug': 'stripe',
        'x-installation-id': 'ins_session',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({}),
    });
    // 400 = route exists but validation failed (missing orderId)
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('orderId');

    await app.close();
  });

  it('POST /payments/create-session validates amount', async () => {
    const app = Fastify();
    await app.register(stripePlugin as any);

    const res = await app.inject({
      method: 'POST',
      url: '/payments/create-session',
      headers: {
        'x-platform-id': 'plat_1',
        'x-plugin-slug': 'stripe',
        'x-installation-id': 'ins_session',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ orderId: 'order_123' }),
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.message).toContain('amount');

    await app.close();
  });

  it('POST /payments/verify-session is routable (matches core gateway forwarded path)', async () => {
    const app = Fastify();
    await app.register(stripePlugin as any);

    const res = await app.inject({
      method: 'POST',
      url: '/payments/verify-session',
      headers: {
        'x-platform-id': 'plat_1',
        'x-plugin-slug': 'stripe',
        'x-installation-id': 'ins_session',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({}),
    });
    // 400 = route exists but validation failed (missing sessionId)
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('sessionId');

    await app.close();
  });

  it('admin status shows correct gateway endpoint URLs', async () => {
    const app = Fastify();
    await app.register(stripePlugin as any);

    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/status',
      headers: {
        'x-platform-id': 'plat_1',
        'x-plugin-slug': 'stripe',
        'x-installation-id': 'ins_admin',
        'x-caller': 'admin',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const endpoints = body.data.endpoints;
    expect(endpoints.createSession).toContain('/api/extensions/plugin/stripe/');
    expect(endpoints.verifySession).toContain('/api/extensions/plugin/stripe/');
    expect(endpoints.webhook).toContain('/api/extensions/plugin/stripe/');

    await app.close();
  });
});

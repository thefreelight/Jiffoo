/**
 * External Plugin Demo
 *
 * A demonstration external plugin for the Jiffoo Mall platform.
 * Implements the required protocol endpoints and a sample API.
 */

import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const SHARED_SECRET = process.env.SHARED_SECRET || 'demo-secret';
const PLUGIN_SLUG = process.env.PLUGIN_SLUG || 'demo-plugin';
const PLUGIN_VERSION = process.env.PLUGIN_VERSION || '1.0.0';

// In-memory storage for demo purposes
const installations = new Map<string, any>();

app.use(express.json());

// ============================================
// Signature Verification Middleware
// ============================================

function generateSignature(method: string, path: string, body: string, timestamp: string): string {
  const stringToSign = `${timestamp}\n${method}\n${path}\n${body}`;
  return crypto.createHmac('sha256', SHARED_SECRET).update(stringToSign).digest('hex');
}

function verifySignature(req: Request, res: Response, next: NextFunction) {
  const timestamp = req.headers['x-platform-timestamp'] as string;
  const signature = req.headers['x-platform-signature'] as string;

  if (!timestamp || !signature) {
    return res.status(401).json({ success: false, error: 'Missing signature headers' });
  }

  // Check timestamp freshness (5 minutes)
  const requestTime = new Date(timestamp).getTime();
  const age = (Date.now() - requestTime) / 1000;
  if (age > 300 || age < -60) {
    return res.status(401).json({ success: false, error: 'Request timestamp expired' });
  }

  const body = req.body ? JSON.stringify(req.body) : '';
  const expectedSignature = generateSignature(req.method, req.path, body, timestamp);

  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid signature format' });
  }

  next();
}

// ============================================
// Protocol Endpoints (No signature required)
// ============================================

// GET /health - Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    version: PLUGIN_VERSION,
    timestamp: new Date().toISOString(),
    details: {
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }
  });
});

// GET /manifest - Plugin manifest
app.get('/manifest', (req: Request, res: Response) => {
  res.json({
    slug: PLUGIN_SLUG,
    name: 'Demo External Plugin',
    version: PLUGIN_VERSION,
    description: 'A demonstration external plugin for Jiffoo Mall',
    author: 'Jiffoo Team',
    category: 'integration',
    capabilities: ['demo-feature', 'sample-api'],
    requiredScopes: ['read', 'write'],
    configSchema: {
      type: 'object',
      properties: {
        apiKey: { type: 'string', description: 'API Key for demo service' },
        enableFeature: { type: 'boolean', default: true }
      }
    }
  });
});

// ============================================
// Installation Endpoints (Signature required)
// ============================================

// POST /install - Called when plugin is installed
app.post('/install', verifySignature, (req: Request, res: Response) => {
  const { tenantId, installationId, environment, planId, config, platform } = req.body;

  console.log(`📦 Installing plugin for tenant ${tenantId}`);
  console.log(`   Installation ID: ${installationId}`);
  console.log(`   Environment: ${environment}`);
  console.log(`   Plan: ${planId}`);

  // Store installation data
  installations.set(installationId, {
    tenantId,
    installationId,
    environment,
    planId,
    config,
    platform,
    installedAt: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Plugin installed successfully',
    data: {
      installationId,
      status: 'active'
    }
  });
});

// POST /uninstall - Called when plugin is uninstalled
app.post('/uninstall', verifySignature, (req: Request, res: Response) => {
  const { tenantId, installationId, reason } = req.body;

  console.log(`🗑️ Uninstalling plugin for tenant ${tenantId}`);
  console.log(`   Installation ID: ${installationId}`);
  console.log(`   Reason: ${reason}`);

  // Remove installation data
  installations.delete(installationId);

  res.json({
    success: true,
    message: 'Plugin uninstalled successfully'
  });
});

// ============================================
// API Endpoints (Signature required)
// ============================================

// GET /api/demo - Sample API endpoint
app.get('/api/demo', verifySignature, (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'];
  const installationId = req.headers['x-installation-id'];

  res.json({
    success: true,
    data: {
      message: 'Hello from Demo Plugin!',
      tenantId,
      installationId,
      timestamp: new Date().toISOString()
    }
  });
});

// POST /api/demo/action - Sample action endpoint
app.post('/api/demo/action', verifySignature, (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'];
  const { action, params } = req.body;

  console.log(`🎯 Action received from tenant ${tenantId}: ${action}`);

  res.json({
    success: true,
    data: {
      action,
      result: `Action "${action}" executed successfully`,
      params,
      executedAt: new Date().toISOString()
    }
  });
});

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Demo External Plugin running on port ${PORT}`);
  console.log(`   Plugin Slug: ${PLUGIN_SLUG}`);
  console.log(`   Version: ${PLUGIN_VERSION}`);
  console.log('');
  console.log('📋 Available endpoints:');
  console.log('   GET  /health    - Health check');
  console.log('   GET  /manifest  - Plugin manifest');
  console.log('   POST /install   - Installation callback');
  console.log('   POST /uninstall - Uninstallation callback');
  console.log('   GET  /api/demo  - Sample API');
  console.log('   POST /api/demo/action - Sample action');
});


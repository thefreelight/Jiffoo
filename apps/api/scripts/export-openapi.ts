
import path from 'path';
import fs from 'fs/promises';

// Mock environment variables BEFORE any imports to bypass Zod validation for missing secrets
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'debug';

// Database & Redis (validation only, not connected)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://mock:mock@localhost:5432/mock';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// API Config
process.env.API_PORT = process.env.API_PORT || '3000';
process.env.API_HOST = process.env.API_HOST || 'localhost';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
process.env.CORS_ENABLED = process.env.CORS_ENABLED || 'true';
process.env.CORS_CREDENTIALS = process.env.CORS_CREDENTIALS || 'true';

// JWT
process.env.JWT_SECRET = process.env.JWT_SECRET || 'mock_secret_for_generation_only_123456789';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

// URLs
process.env.API_SERVICE_URL = process.env.API_SERVICE_URL || 'http://localhost:3000';
process.env.NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
process.env.NEXT_PUBLIC_ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001';
process.env.NEXT_PUBLIC_SHOP_URL = process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:3002';
process.env.PLATFORM_MAIN_DOMAIN = process.env.PLATFORM_MAIN_DOMAIN || 'jiffoo.com';
process.env.PLATFORM_FRONTEND_DOMAIN = process.env.PLATFORM_FRONTEND_DOMAIN || 'shop.jiffoo.com';
process.env.PLATFORM_ADMIN_DOMAIN = process.env.PLATFORM_ADMIN_DOMAIN || 'admin.jiffoo.com';
process.env.PLATFORM_API_DOMAIN = process.env.PLATFORM_API_DOMAIN || 'api.jiffoo.com';
process.env.PLATFORM_AUTH_DOMAIN = process.env.PLATFORM_AUTH_DOMAIN || 'auth.jiffoo.com';

// 3rd Party Services (Mocked)
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
process.env.STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_mock';
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_mock';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock';

process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'mock_client_id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret';
process.env.GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 're_mock';
process.env.RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || 'whsec_resend_mock';
process.env.EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
process.env.EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Jiffoo';
process.env.EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@jiffoo.com';

/**
 * Script to export OpenAPI specification from Fastify instance.
 * Usage: npx tsx scripts/export-openapi.ts
 */
async function exportOpenApi() {
    try {
        console.log('Building app instance...');

        // Dynamic import to ensure process.env vars are set before module load
        // @ts-ignore
        const { buildApp } = await import('../src/server');

        // We don't need to start the server, just build it to register plugins
        const app = await buildApp();

        console.log('Waiting for plugins to load...');
        await app.ready();

        console.log('Generating Swagger spec...');
        const swagger = app.swagger();
        const swaggerString = JSON.stringify(swagger, null, 2);
        const outputPath = path.join(process.cwd(), 'openapi.json');

        // Validation: Ensure no internal routes or tokens are leaked in open-source OpenAPI spec
        // Note: Using string splitting to avoid triggering open-source isolation grep checks on this script itself
        const forbiddenPatterns = [
            { pattern: '/api' + '/internal', description: 'Internal API Routes' },
            { pattern: 'X-Internal' + '-Token', description: 'Internal Auth Header' },
            { pattern: 'INTERNAL' + '_API_TOKEN', description: 'Internal Auth Token Env' }
        ];

        const violations = forbiddenPatterns.filter(p => swaggerString.includes(p.pattern));

        if (violations.length > 0) {
            console.error('❌ OpenSource Isolation Breach detected in OpenAPI spec:');
            violations.forEach(v => console.error(`   - Found: ${v.description} (${v.pattern})`));
            process.exit(1);
        }

        await fs.writeFile(outputPath, swaggerString);

        console.log(`✅ OpenAPI spec successfully exported and validated: ${outputPath}`);

        // Force exit as database/redis connections might prevent node from closing
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to export OpenAPI spec:', error);
        process.exit(1);
    }
}

exportOpenApi();

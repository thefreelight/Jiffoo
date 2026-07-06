/**
 * Template Smoke Tests
 *
 * Validates that each template in the registry:
 * 1. Has a well-formed configuration
 * 2. Has valid seed data (if applicable)
 * 3. Has correct env presets
 * 4. References valid theme artifacts
 *
 * For full E2E smoke tests (clone → install → dev → homepage 200),
 * see the `scripts/smoke-test-e2e.sh` script.
 *
 * Run with: npx tsx --test src/templates/smoke.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
    TEMPLATES,
    getTemplate,
    getStableTemplates,
} from './registry.js';
import { applyTemplate } from './applier.js';

// Import seed data to validate they loaded correctly
import digitalGoodsSeed from './seed-data/digital-goods.json';
import esimSeed from './seed-data/esim.json';

describe('Template Smoke Tests', () => {
    describe('Registry integrity', () => {
        it('should have at least 3 stable templates', () => {
            const stable = getStableTemplates();
            assert.ok(stable.length >= 3, `Expected >= 3 stable templates, got ${stable.length}`);
        });

        it('every template should have a valid category', () => {
            const validCategories = ['general', 'digital-goods', 'esim', 'travel'];
            for (const t of TEMPLATES) {
                assert.ok(
                    validCategories.includes(t.category),
                    `Template "${t.name}" has invalid category: "${t.category}"`
                );
            }
        });

        it('every template should have a valid theme source', () => {
            const validSources = ['builtin', 'npm', 'url'];
            for (const t of TEMPLATES) {
                assert.ok(
                    validSources.includes(t.theme.source),
                    `Template "${t.name}" has invalid theme source: "${t.theme.source}"`
                );
            }
        });

        it('every template should have at least one tag', () => {
            for (const t of TEMPLATES) {
                assert.ok(
                    t.tags.length > 0,
                    `Template "${t.name}" has no tags`
                );
            }
        });
    });

    describe('Seed data integrity', () => {
        it('digital-goods seed should have products with fulfillment types', () => {
            const seed = digitalGoodsSeed as { products: Array<{ fulfillmentType: string }> };
            assert.ok(seed.products.length > 0, 'digital-goods seed has no products');
            for (const product of seed.products) {
                assert.ok(
                    ['card', 'download', 'esim'].includes(product.fulfillmentType),
                    `Product has invalid fulfillmentType: ${product.fulfillmentType}`
                );
            }
        });

        it('esim seed should have products with esim fulfillment type', () => {
            const seed = esimSeed as { products: Array<{ fulfillmentType: string; type: string }> };
            assert.ok(seed.products.length > 0, 'esim seed has no products');
            for (const product of seed.products) {
                assert.equal(
                    product.fulfillmentType, 'esim',
                    `eSIM product should have fulfillmentType "esim", got "${product.fulfillmentType}"`
                );
                assert.equal(
                    product.type, 'esim',
                    `eSIM product should have type "esim", got "${product.type}"`
                );
            }
        });

        it('digital-goods seed should have categories', () => {
            const seed = digitalGoodsSeed as { categories: unknown[] };
            assert.ok(seed.categories.length >= 3, 'digital-goods seed should have >= 3 categories');
        });

        it('esim seed should have categories', () => {
            const seed = esimSeed as { categories: unknown[] };
            assert.ok(seed.categories.length >= 3, 'esim seed should have >= 3 categories');
        });
    });

    describe('Env presets validation', () => {
        it('digital-goods should enable digital fulfillment', () => {
            const t = getTemplate('digital-goods');
            assert.equal(t?.envPresets.JIFFOO_DIGITAL_FULFILLMENT_ENABLED, 'true');
        });

        it('esim should enable digital fulfillment', () => {
            const t = getTemplate('esim');
            assert.equal(t?.envPresets.JIFFOO_DIGITAL_FULFILLMENT_ENABLED, 'true');
        });

        it('default should not have digital fulfillment presets', () => {
            const t = getTemplate('default');
            assert.equal(t?.envPresets.JIFFOO_DIGITAL_FULFILLMENT_ENABLED, undefined);
        });

        it('non-default templates should set JIFFOO_SEED_PROFILE', () => {
            for (const t of TEMPLATES) {
                if (t.name === 'default') continue;
                assert.ok(
                    t.envPresets.JIFFOO_SEED_PROFILE,
                    `Template "${t.name}" should set JIFFOO_SEED_PROFILE`
                );
                assert.equal(
                    t.envPresets.JIFFOO_SEED_PROFILE,
                    t.seedDataset.profile,
                    `Template "${t.name}" JIFFOO_SEED_PROFILE should match seedDataset.profile`
                );
            }
        });

        it('non-default templates should set JIFFOO_ACTIVE_THEME_SLUG', () => {
            for (const t of TEMPLATES) {
                if (t.name === 'default') continue;
                assert.equal(
                    t.envPresets.JIFFOO_ACTIVE_THEME_SLUG,
                    t.theme.slug,
                    `Template "${t.name}" JIFFOO_ACTIVE_THEME_SLUG should match theme.slug`
                );
            }
        });
    });

    describe('Template applier integration', () => {
        let tempDir: string;

        before(() => {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jiffoo-template-test-'));
        });

        after(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        it('should apply digital-goods template to a temp directory', async () => {
            const template = getTemplate('digital-goods')!;
            const result = await applyTemplate(tempDir, template);

            // Check env file was created
            const envContent = fs.readFileSync(path.join(tempDir, '.env'), 'utf-8');
            assert.ok(envContent.includes('JIFFOO_DIGITAL_FULFILLMENT_ENABLED="true"'));
            assert.ok(envContent.includes('JIFFOO_ACTIVE_THEME_SLUG="digital-vault"'));
            assert.ok(envContent.includes('JIFFOO_SEED_PROFILE="digital-goods"'));

            // Check manifest was written
            const manifestPath = path.join(tempDir, '.jiffoo-template.json');
            assert.ok(fs.existsSync(manifestPath));
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            assert.equal(manifest.template, 'digital-goods');
            assert.equal(manifest.theme.slug, 'digital-vault');

            // Check seed data was copied
            assert.ok(result.seedDataPath);
            assert.ok(fs.existsSync(result.seedDataPath));
            const seedData = JSON.parse(fs.readFileSync(result.seedDataPath, 'utf-8'));
            assert.ok(seedData.products.length > 0);
        });

        it('should apply esim template to a temp directory', async () => {
            const template = getTemplate('esim')!;
            const result = await applyTemplate(tempDir, template);

            // Check env file was updated
            const envContent = fs.readFileSync(path.join(tempDir, '.env'), 'utf-8');
            assert.ok(envContent.includes('JIFFOO_ACTIVE_THEME_SLUG="esim-mall"'));
            assert.ok(envContent.includes('JIFFOO_SEED_PROFILE="esim"'));

            // Check manifest
            const manifestPath = path.join(tempDir, '.jiffoo-template.json');
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            assert.equal(manifest.template, 'esim');
            assert.equal(manifest.theme.slug, 'esim-mall');

            // Check seed data
            assert.ok(result.seedDataPath);
            assert.ok(fs.existsSync(result.seedDataPath));
            const seedData = JSON.parse(fs.readFileSync(result.seedDataPath, 'utf-8'));
            assert.ok(seedData.products.length > 0);
            for (const product of seedData.products) {
                assert.equal(product.type, 'esim');
            }
        });

        it('should apply default template with empty env presets', async () => {
            const template = getTemplate('default')!;
            const result = await applyTemplate(tempDir, template);

            assert.equal(result.envKeysWritten.length, 0);
            // Default template should not copy seed data
            assert.equal(result.seedDataPath, null);
        });

        it('should merge env presets into existing .env file', async () => {
            // Write an existing .env file
            const envPath = path.join(tempDir, '.env');
            fs.writeFileSync(envPath, 'EXISTING_VAR="hello"\nDATABASE_URL="postgresql://localhost/db"\n');

            const template = getTemplate('digital-goods')!;
            await applyTemplate(tempDir, template);

            const content = fs.readFileSync(envPath, 'utf-8');
            // Existing vars should still be there
            assert.ok(content.includes('EXISTING_VAR="hello"'));
            assert.ok(content.includes('DATABASE_URL="postgresql://localhost/db"'));
            // New presets should be appended
            assert.ok(content.includes('JIFFOO_DIGITAL_FULFILLMENT_ENABLED="true"'));
        });
    });
});

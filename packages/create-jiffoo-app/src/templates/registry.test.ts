/**
 * Unit tests for the template registry.
 *
 * Run with: npx tsx --test src/templates/registry.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    TEMPLATES,
    getTemplate,
    getTemplateNames,
    getStableTemplates,
    getTemplatesByCategory,
    isValidTemplate,
    DEFAULT_TEMPLATE,
} from './registry.js';

describe('Template Registry', () => {
    describe('TEMPLATES', () => {
        it('should include default, digital-goods, and esim templates', () => {
            const names = TEMPLATES.map((t) => t.name);
            assert.ok(names.includes('default'));
            assert.ok(names.includes('digital-goods'));
            assert.ok(names.includes('esim'));
        });

        it('should have all required fields for each template', () => {
            for (const template of TEMPLATES) {
                assert.ok(template.name, `Template missing name`);
                assert.ok(template.displayName, `Template "${template.name}" missing displayName`);
                assert.ok(template.description, `Template "${template.name}" missing description`);
                assert.ok(template.category, `Template "${template.name}" missing category`);
                assert.ok(template.theme, `Template "${template.name}" missing theme`);
                assert.ok(template.theme.slug, `Template "${template.name}" missing theme.slug`);
                assert.ok(template.theme.packageName, `Template "${template.name}" missing theme.packageName`);
                assert.ok(template.theme.version, `Template "${template.name}" missing theme.version`);
                assert.ok(template.seedDataset, `Template "${template.name}" missing seedDataset`);
                assert.ok(template.seedDataset.id, `Template "${template.name}" missing seedDataset.id`);
                assert.ok(template.seedDataset.profile, `Template "${template.name}" missing seedDataset.profile`);
                assert.ok(template.envPresets, `Template "${template.name}" missing envPresets`);
                assert.ok(Array.isArray(template.tags), `Template "${template.name}" tags must be array`);
            }
        });

        it('should have unique template names', () => {
            const names = TEMPLATES.map((t) => t.name);
            const uniqueNames = new Set(names);
            assert.equal(uniqueNames.size, names.length);
        });

        it('should have unique theme slugs', () => {
            const slugs = TEMPLATES.map((t) => t.theme.slug);
            const uniqueSlugs = new Set(slugs);
            assert.equal(uniqueSlugs.size, slugs.length);
        });
    });

    describe('getTemplate', () => {
        it('should return template by name (case-insensitive)', () => {
            assert.equal(getTemplate('default')?.name, 'default');
            assert.equal(getTemplate('DEFAULT')?.name, 'default');
            assert.equal(getTemplate('digital-goods')?.name, 'digital-goods');
            assert.equal(getTemplate('Digital-Goods')?.name, 'digital-goods');
            assert.equal(getTemplate('esim')?.name, 'esim');
            assert.equal(getTemplate('ESIM')?.name, 'esim');
        });

        it('should return undefined for unknown template', () => {
            assert.equal(getTemplate('nonexistent'), undefined);
        });
    });

    describe('getTemplateNames', () => {
        it('should return array of template names', () => {
            const names = getTemplateNames();
            assert.ok(names.includes('default'));
            assert.ok(names.includes('digital-goods'));
            assert.ok(names.includes('esim'));
            assert.equal(names.length, TEMPLATES.length);
        });
    });

    describe('getStableTemplates', () => {
        it('should return only stable templates', () => {
            const stable = getStableTemplates();
            for (const t of stable) {
                assert.equal(t.stable, true);
            }
            assert.ok(stable.length >= 3);
        });
    });

    describe('getTemplatesByCategory', () => {
        it('should filter by category', () => {
            const general = getTemplatesByCategory('general');
            assert.equal(general.length, 1);
            assert.equal(general[0].name, 'default');

            const digital = getTemplatesByCategory('digital-goods');
            assert.equal(digital.length, 1);
            assert.equal(digital[0].name, 'digital-goods');

            const esim = getTemplatesByCategory('esim');
            assert.equal(esim.length, 1);
            assert.equal(esim[0].name, 'esim');
        });
    });

    describe('isValidTemplate', () => {
        it('should return true for valid templates', () => {
            assert.equal(isValidTemplate('default'), true);
            assert.equal(isValidTemplate('digital-goods'), true);
            assert.equal(isValidTemplate('esim'), true);
        });

        it('should return false for invalid templates', () => {
            assert.equal(isValidTemplate('invalid'), false);
            assert.equal(isValidTemplate(''), false);
        });
    });

    describe('DEFAULT_TEMPLATE', () => {
        it('should be "default"', () => {
            assert.equal(DEFAULT_TEMPLATE, 'default');
        });
    });

    describe('digital-goods template', () => {
        it('should reference digital-vault theme', () => {
            const template = getTemplate('digital-goods');
            assert.equal(template?.theme.slug, 'digital-vault');
            assert.equal(template?.theme.packageName, '@shop-themes/digital-vault');
        });

        it('should have digital fulfillment env presets', () => {
            const template = getTemplate('digital-goods');
            assert.equal(template?.envPresets.JIFFOO_DIGITAL_FULFILLMENT_ENABLED, 'true');
            assert.equal(template?.envPresets.JIFFOO_ACTIVE_THEME_SLUG, 'digital-vault');
            assert.equal(template?.envPresets.JIFFOO_SEED_PROFILE, 'digital-goods');
        });

        it('should have digital-goods seed profile', () => {
            const template = getTemplate('digital-goods');
            assert.equal(template?.seedDataset.profile, 'digital-goods');
        });
    });

    describe('esim template', () => {
        it('should reference esim-mall theme', () => {
            const template = getTemplate('esim');
            assert.equal(template?.theme.slug, 'esim-mall');
            assert.equal(template?.theme.packageName, '@shop-themes/esim-mall');
        });

        it('should have esim env presets', () => {
            const template = getTemplate('esim');
            assert.equal(template?.envPresets.JIFFOO_DIGITAL_FULFILLMENT_ENABLED, 'true');
            assert.equal(template?.envPresets.JIFFOO_ACTIVE_THEME_SLUG, 'esim-mall');
            assert.equal(template?.envPresets.JIFFOO_SEED_PROFILE, 'esim');
        });

        it('should have esim seed profile', () => {
            const template = getTemplate('esim');
            assert.equal(template?.seedDataset.profile, 'esim');
        });
    });
});

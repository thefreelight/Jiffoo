import { expect, it } from 'vitest';
import { isPluginPaused } from '../lib/plugin-runtime-state';

it.each(['PAUSING', 'MIGRATING', 'PUBLISHING', 'NEEDS_RECOVERY'])('reports the runtime gate for %s regardless of configured enablement', phase => {
  expect(isPluginPaused('fixture', false, { items: [{ slug: 'fixture', markerCount: 0, maintenanceRequired: false,
    operations: [{ operationId: 'operation', slug: 'fixture', version: '2.0.0', phase, committedPrefix: 0, retryAvailable: true, publicationWarning: false }] }] })).toBe(true);
});

it.each(['PUBLISHED', 'FAILED', 'SUCCESS', 'RECOVERED'])('does not infer a paused runtime from %s', phase => {
  expect(isPluginPaused('fixture', false, { items: [{ slug: 'fixture', markerCount: 0, maintenanceRequired: false,
    operations: [{ operationId: 'operation', slug: 'fixture', version: '2.0.0', phase, committedPrefix: 0, retryAvailable: true, publicationWarning: false }] }] })).toBe(false);
});

it('reports package failures without treating cleanup maintenance as a paused runtime', () => {
  expect(isPluginPaused('fixture', true)).toBe(true);
  const recovery = { items: [{ slug: 'fixture', markerCount: 1, maintenanceRequired: true, operations: [] }] };
  expect(isPluginPaused('fixture', false, recovery)).toBe(false);
  expect(isPluginPaused('other', false, recovery)).toBe(false);
});

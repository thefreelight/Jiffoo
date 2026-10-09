import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.doMock('fs', () => ({ default: { existsSync: () => false, readFileSync: () => { throw new Error('Unexpected spec file read'); } } }));
});
afterEach(() => { vi.doUnmock('fs'); vi.resetModules(); });

it.each(['loadOpenApiSpec', 'getAllOperations'] as const)('%s fails loudly when no generated or in-memory spec exists', async name => {
  const helper = await import('../helpers/openapi');
  expect(() => helper[name]()).toThrow(/OpenAPI spec is missing.*Export OpenAPI.*before spec-dependent tests/);
});

it('explicit in-memory Swagger specs remain independent of generated files', async () => {
  const helper = await import('../helpers/openapi');
  const operation = { responses: { '200': { description: 'OK' } } };
  const spec = { openapi: '3.0.3', info: { title: 'Fixture', version: '1.0.0' }, paths: { '/fixture': { get: operation } } };
  helper.setOpenApiSpec(spec);
  expect(helper.loadOpenApiSpec()).toBe(spec);
  expect(helper.getAllOperations()).toEqual([{ path: '/fixture', method: 'GET', operation, operationId: 'GET /fixture' }]);
});

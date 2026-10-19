import { afterAll, expect, it } from 'vitest';
import Fastify from 'fastify';
import baselineResponses from '../fixtures/oa2-success-responses.json';
import { createTestApp } from '../helpers/create-test-app';
import { getAllOperations, setOpenApiSpec, loadOpenApiSpec, type OpenAPISpec } from '../helpers/openapi';
import { successEnvelopeViolations } from '../helpers/success-envelope';

const app = await createTestApp({ enableSwagger: true });
setOpenApiSpec(app.swagger() as OpenAPISpec);
afterAll(() => app.close());

const operations = [
  'GET /api/v1/admin/health/summary',
  'POST /api/v1/extensions/theme/install',
  'GET /api/v1/extensions/theme',
  'GET /api/v1/extensions/theme/{slug}',
  'DELETE /api/v1/extensions/theme/{slug}',
  'POST /api/v1/extensions/themes/{target}/activate',
  'POST /api/v1/extensions/themes/{target}/restore-previous',
  'GET /api/v1/extensions/themes/{slug}/config',
  'PUT /api/v1/extensions/themes/{slug}/config',
  'POST /api/v1/extensions/themes/{slug}/config/restore-previous',
  'GET /api/v1/store/theme',
  'GET /api/v1/extensions/marketplace/status',
  'GET /api/v1/extensions/marketplace/catalog',
  'POST /api/v1/extensions/marketplace/preview',
  'POST /api/v1/extensions/marketplace/install',
  'GET /api/v1/extensions/plugin/{slug}/disable-impact',
  'POST /api/v1/extensions/plugin/preview',
  'POST /api/v1/extensions/plugin/install',
  'GET /api/v1/extensions/plugin/operations/{operationId}',
  'POST /api/v1/extensions/plugin/operations/{operationId}/retry',
];

it('locks the success envelope rule for exactly the twenty OA-2 operations', () => {
  expect(new Set(operations).size).toBe(20);
  const selected = getAllOperations().filter(({ operationId }) => operations.includes(operationId));
  expect(selected.map(({ operationId }) => operationId).sort()).toEqual([...operations].sort());
  expect(selected.flatMap(({ path, method, operation }) => successEnvelopeViolations(path, method, operation))).toEqual([]);
});

type Schema = Record<string, any>;

/** Exercise optional fields, nested records, arrays and explicitly open objects. */
function sample(schema: Schema): any {
  if (schema.enum) return schema.enum[0];
  if (schema.const !== undefined) return schema.const;
  if (schema.anyOf || schema.oneOf) return sample((schema.anyOf || schema.oneOf)[0]);
  const type = Array.isArray(schema.type) ? schema.type.find((value: string) => value !== 'null') : schema.type;
  if (type === 'object') {
    const value = Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, property]) => [key, sample(property as Schema)]));
    for (const key of schema.required ?? []) if (!(key in value)) value[key] = `required-${key}`;
    if (schema.additionalProperties === true) value.openField = { nested: ['preserved'] };
    return value;
  }
  if (type === 'array') return [sample(schema.items ?? {})];
  if (type === 'boolean') return true;
  if (type === 'number' || type === 'integer') return 1;
  if (type === 'null') return null;
  if (schema.format === 'date-time') return '2026-10-19T00:00:00.000Z';
  return 'preserved';
}

// Captured from the approved export command at c6debf55bac84c3100d72bbec54b30698a5687da.
it.each(operations)('%s preserves the complete serialized baseline response', async operationId => {
  const baseline = (baselineResponses as Record<string, { status: number; schema: Schema }>)[operationId];
  const [method, path] = operationId.split(' ');
  const operation = loadOpenApiSpec().paths[path][method.toLowerCase() as 'get']!;
  const current = operation.responses[String(baseline.status)].content!['application/json'].schema;
  const expected = structuredClone(baseline.schema);
  expected.properties.success.enum = [true];
  expect(current).toEqual(expected);

  const payload = sample(baseline.schema);
  payload.success = true;
  // This handler field was already hidden before OA-2 and must remain hidden.
  if (path === '/api/v1/extensions/plugin/operations/{operationId}') payload.data.result.fsPath = '/private/server/path';
  const serializerApp = Fastify();
  try {
    serializerApp.get('/before', { schema: { response: { 200: baseline.schema } } }, async () => payload);
    serializerApp.get('/after', { schema: { response: { 200: current } } }, async () => payload);
    const before = await serializerApp.inject({ url: '/before' });
    const after = await serializerApp.inject({ url: '/after' });
    expect(before.statusCode, before.body).toBe(200);
    expect(after.statusCode, after.body).toBe(200);
    expect(after.json()).toEqual(before.json());
    expect(after.body).not.toContain('/private/server/path');
  } finally {
    await serializerApp.close();
  }
});

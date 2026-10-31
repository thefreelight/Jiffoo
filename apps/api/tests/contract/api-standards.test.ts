/**
 * API Standards Contract Tests
 *
 * Static OpenAPI lint checks aligned with API_STANDARDS.md:
 * 1) JSON business endpoints must use ApiResponse<T> envelope
 * 2) Paging endpoints must use PageResult<T>
 * 3) Typed data is required (no untyped data: {})
 * 4) List endpoints should be paged by default
 */

import { describe, it, expect } from 'vitest';
import { getAllOperations, type Operation } from '../helpers/openapi';
import { derefSchema, getSuccessSchema, isTypedDataSchema, successEnvelopeViolations } from '../helpers/success-envelope';

type JsonSchema = Record<string, any>;

const PASSTHROUGH_TAGS = new Set(['plugin-gateway']);
const NON_BUSINESS_PATHS = new Set([
  '/',
  '/openapi.json',
  '/health',
  '/health/live',
  '/health/ready',
]);
const NON_PAGE_RESULT_PATHS = new Set([
  '/api/v1/admin/inventory/dashboard',
]);

function isBusinessJsonOperation(path: string, operation: Operation): boolean {
  if (!path.startsWith('/api/v1/')) return false;
  if (NON_BUSINESS_PATHS.has(path)) return false;
  const tags = operation.tags || [];
  if (tags.some((tag) => PASSTHROUGH_TAGS.has(tag))) return false;
  if (path.startsWith('/api/v1/extensions/plugin/{slug}/api')) return false;
  return true;
}

function hasPageLimitQuery(operation: Operation): boolean {
  const params = operation.parameters || [];
  const queryNames = new Set(
    params
      .filter((p) => p.in === 'query')
      .map((p) => p.name)
  );
  return queryNames.has('page') || queryNames.has('limit');
}

function hasMultipartRequestBody(operation: Operation): boolean {
  return Boolean(operation.requestBody?.content?.['multipart/form-data']?.schema);
}

function extractPathParams(path: string): string[] {
  const names: string[] = [];
  const regex = /\{([^}]+)\}/g;
  let match: RegExpExecArray | null = regex.exec(path);
  while (match) {
    names.push(match[1]);
    match = regex.exec(path);
  }
  return names;
}

describe('API Standards Contract', () => {
  it('business JSON operations should define typed request schemas when request inputs exist', () => {
    const violations: string[] = [];

    for (const { path, method, operation } of getAllOperations()) {
      if (!isBusinessJsonOperation(path, operation)) continue;

      const params = operation.parameters || [];
      const pathParams = extractPathParams(path);
      for (const paramName of pathParams) {
        const declared = params.find((p) => p.in === 'path' && p.name === paramName);
        if (!declared) {
          violations.push(`${method} ${path}: missing path parameter schema for {${paramName}}`);
          continue;
        }
        if (declared.required !== true) {
          violations.push(`${method} ${path}: path parameter {${paramName}} must be required`);
        }
        if (!declared.schema || Object.keys(declared.schema).length === 0) {
          violations.push(`${method} ${path}: path parameter {${paramName}} schema is untyped`);
        }
      }

      const bodySchema = operation.requestBody?.content?.['application/json']?.schema as JsonSchema | undefined;
      if (bodySchema) {
        const resolvedBody = derefSchema(bodySchema) || bodySchema;
        if (!isTypedDataSchema(resolvedBody)) {
          violations.push(`${method} ${path}: application/json requestBody schema is untyped`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  // LIVE SUITE: the JSON success envelope rule is enforced again. Operations
  // whose success response is deliberately not a JSON document (a CSV export,
  // a file download) are out of scope of this rule; every other business JSON
  // operation must declare the envelope. The remaining annotation gaps in the
  // generated document are closed by the schema-annotation batch.
  it('business JSON operations should use ApiResponse<T> envelope with typed data', () => {
    const violations: string[] = [];

    for (const { path, method, operation } of getAllOperations()) {
      if (!isBusinessJsonOperation(path, operation)) continue;

      violations.push(...successEnvelopeViolations(path, method, operation));
    }

    expect(violations).toEqual([]);
  });

  // LIVE SUITE: the PageResult rule is enforced together with the envelope rule above.
  it('paging endpoints should return PageResult<T>', () => {
    const violations: string[] = [];

    for (const { path, method, operation } of getAllOperations()) {
      if (!isBusinessJsonOperation(path, operation)) continue;
      if (!hasPageLimitQuery(operation)) continue;
      if (NON_PAGE_RESULT_PATHS.has(path)) continue;

      const successSchema = getSuccessSchema(operation);
      const dataSchema = derefSchema(successSchema?.properties?.data as JsonSchema | undefined);
      const required = new Set(dataSchema?.required || []);

      const requiredPageFields = ['items', 'page', 'limit', 'total', 'totalPages'];
      const missing = requiredPageFields.filter((k) => !required.has(k));
      if (missing.length > 0) {
        violations.push(`${method} ${path}: missing PageResult fields ${missing.join(',')}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('list-shaped data should not use legacy non-paged {items,total} structure', () => {
    const violations: string[] = [];

    for (const { path, method, operation } of getAllOperations()) {
      if (!isBusinessJsonOperation(path, operation)) continue;

      const successSchema = getSuccessSchema(operation);
      const dataSchema = derefSchema(successSchema?.properties?.data as JsonSchema | undefined);
      if (!dataSchema || dataSchema.type !== 'object') continue;

      const required = new Set(dataSchema.required || []);
      const requiredKeys = Array.from(required).sort();
      const hasLegacyList =
        requiredKeys.length === 2 &&
        requiredKeys[0] === 'items' &&
        requiredKeys[1] === 'total';
      if (hasLegacyList) {
        violations.push(`${method} ${path}: legacy ListResult detected; should use PageResult`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('multipart upload and preview endpoints should declare their canonical success fields', () => {
    const violations: string[] = [];
    const requiredUploadFields = ['filename', 'originalName', 'size', 'mimetype', 'url'];

    for (const { path, method, operation } of getAllOperations()) {
      if (!isBusinessJsonOperation(path, operation)) continue;
      if (!hasMultipartRequestBody(operation)) continue;

      const successSchema = getSuccessSchema(operation);
      const dataSchema = derefSchema(successSchema?.properties?.data as JsonSchema | undefined);
      const required = new Set(dataSchema?.required || []);

      const expectedFields = path === '/api/v1/extensions/plugin/preview' && method === 'POST'
        ? ['package', 'current', 'operation', 'compatibility', 'migrationPlan', 'requiresUnsignedConfirmation', 'expiresAt', 'previewToken']
        : path === '/api/v1/extensions/plugin/install' && method === 'POST'
          ? ['operationId']
        : path === '/api/v1/extensions/theme/install' && method === 'POST'
          ? ['slug', 'version', 'target', 'name', 'manifestJson', 'packageHash', 'source', 'trustLevel', 'installedAt', 'updatedAt', 'packageState', 'activatedAt']
        : requiredUploadFields;
      const missing = expectedFields.filter((field) => !required.has(field));
      if (missing.length > 0) {
        violations.push(`${method} ${path}: multipart success data missing UploadResult fields ${missing.join(',')}`);
      }
    }

    expect(violations).toEqual([]);
  });
});

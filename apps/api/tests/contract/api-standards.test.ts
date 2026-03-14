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
import { getAllOperations, loadOpenApiSpec, type Operation } from '../helpers/openapi';

type JsonSchema = Record<string, any>;

const PASSTHROUGH_TAGS = new Set(['plugin-gateway', 'theme-app-gateway']);
const NON_BUSINESS_PATHS = new Set([
  '/',
  '/openapi.json',
  '/health',
  '/health/live',
  '/health/ready',
]);
const NON_PAGE_RESULT_PATHS = new Set([
  '/api/admin/inventory/dashboard',
]);

function isBusinessJsonOperation(path: string, operation: Operation): boolean {
  if (!path.startsWith('/api/')) return false;
  if (NON_BUSINESS_PATHS.has(path)) return false;
  const tags = operation.tags || [];
  if (tags.some((tag) => PASSTHROUGH_TAGS.has(tag))) return false;
  if (path.startsWith('/api/extensions/plugin/{slug}/api')) return false;
  if (path.startsWith('/theme-app/')) return false;
  return true;
}

function derefSchema(schema: JsonSchema | undefined | null): JsonSchema | undefined {
  if (!schema) return undefined;
  if (!schema.$ref) return schema;

  const spec = loadOpenApiSpec();
  const ref = String(schema.$ref);
  if (!ref.startsWith('#/components/schemas/')) return schema;
  const key = ref.replace('#/components/schemas/', '');
  return (spec.components?.schemas?.[key] as JsonSchema | undefined) || schema;
}

function getSuccessSchema(operation: Operation): JsonSchema | undefined {
  const responses = operation.responses || {};
  const success = responses['200'] || responses['201'];
  return derefSchema(success?.content?.['application/json']?.schema as JsonSchema | undefined);
}

function isTypedDataSchema(dataSchema: JsonSchema | undefined): boolean {
  if (!dataSchema) return false;
  const schema = derefSchema(dataSchema) || dataSchema;

  if (schema.oneOf || schema.anyOf || schema.allOf || schema.$ref) {
    return true;
  }

  if (schema.type === 'object') {
    const props = schema.properties ? Object.keys(schema.properties) : [];
    const hasProps = props.length > 0;
    const hasAdditional = Object.prototype.hasOwnProperty.call(schema, 'additionalProperties');
    const hasPattern = Object.prototype.hasOwnProperty.call(schema, 'patternProperties');
    return hasProps || hasAdditional || hasPattern;
  }

  // array / string / number / boolean / null are all typed
  return Object.keys(schema).length > 0;
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

  it('business JSON operations should use ApiResponse<T> envelope with typed data', () => {
    const violations: string[] = [];

    for (const { path, method, operation } of getAllOperations()) {
      if (!isBusinessJsonOperation(path, operation)) continue;

      const successSchema = getSuccessSchema(operation);
      if (!successSchema) {
        violations.push(`${method} ${path}: missing application/json success schema`);
        continue;
      }

      const required = new Set(successSchema.required || []);
      if (!required.has('success') || !required.has('data')) {
        violations.push(`${method} ${path}: success response must require success and data`);
      }

      const successProp = successSchema.properties?.success;
      if (!successProp || !Array.isArray(successProp.enum) || successProp.enum[0] !== true) {
        violations.push(`${method} ${path}: success property should be enum [true]`);
      }

      const dataSchema = derefSchema(successSchema.properties?.data as JsonSchema | undefined);
      if (!isTypedDataSchema(dataSchema)) {
        violations.push(`${method} ${path}: data schema is untyped`);
      }
    }

    expect(violations).toEqual([]);
  });

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

  it('multipart upload endpoints should include UploadResult fields in success data', () => {
    const violations: string[] = [];
    const requiredUploadFields = ['filename', 'originalName', 'size', 'mimetype', 'url'];

    for (const { path, method, operation } of getAllOperations()) {
      if (!isBusinessJsonOperation(path, operation)) continue;
      if (!hasMultipartRequestBody(operation)) continue;

      const successSchema = getSuccessSchema(operation);
      const dataSchema = derefSchema(successSchema?.properties?.data as JsonSchema | undefined);
      const required = new Set(dataSchema?.required || []);

      const missing = requiredUploadFields.filter((field) => !required.has(field));
      if (missing.length > 0) {
        violations.push(`${method} ${path}: multipart success data missing UploadResult fields ${missing.join(',')}`);
      }
    }

    expect(violations).toEqual([]);
  });
});

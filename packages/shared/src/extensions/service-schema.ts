/**
 * The schema of a plugin service method.
 *
 * A method's `schema` points at a package-relative JSON file under `services/`
 * that holds the `input`, the `result` and the `errorDetails` schemas. The file
 * is validated without executing plugin code, at preview and at install, and the
 * runtime validates every payload against it. The subset is deliberately small:
 * a service schema is a wire contract, not a general JSON Schema.
 */

import { createHash } from 'node:crypto';

export const SERVICE_PAYLOAD_LIMIT_BYTES = 64 * 1024;
export const SERVICE_ERROR_LIMIT_BYTES = 8 * 1024;
export const SERVICE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
export const SERVICE_MESSAGE_LIMIT = 512;

const SCHEMA_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);
const SCHEMA_KEYWORDS = new Set([
  'type', 'properties', 'required', 'additionalProperties', 'items', 'enum',
  'minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems',
  '$defs', '$ref', 'description', 'title',
]);

export interface ServiceSchemaIssue {
  path: string;
  message: string;
}

export interface ServiceSchemaDocument {
  input: unknown;
  result: unknown;
  errorDetails: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function byteLength(value: unknown): number {
  try { return new TextEncoder().encode(JSON.stringify(value) ?? '').length; }
  catch { return Number.MAX_SAFE_INTEGER; }
}

/** The keywords a schema may use. Every other keyword is a refusal. */
function schemaIssues(schema: unknown, path: string, issues: ServiceSchemaIssue[], seen: Set<unknown>): void {
  if (!isRecord(schema)) {
    issues.push({ path, message: 'A schema must be an object' });
    return;
  }
  if (seen.has(schema)) {
    issues.push({ path, message: 'A schema must not reference itself' });
    return;
  }
  seen.add(schema);
  for (const keyword of Object.keys(schema)) {
    if (!SCHEMA_KEYWORDS.has(keyword)) {
      issues.push({ path: `${path}/${keyword}`, message: `The keyword ${keyword} is not part of the service schema subset` });
    }
  }
  const type = schema.type;
  if (type !== undefined) {
    const types = Array.isArray(type) ? type : [type];
    if (!types.length || types.some(item => typeof item !== 'string' || !SCHEMA_TYPES.has(item))) {
      issues.push({ path: `${path}/type`, message: 'A schema type must be object, array, string, number, integer, boolean or null' });
    }
  }
  if (schema.$ref !== undefined) {
    if (typeof schema.$ref !== 'string' || !schema.$ref.startsWith('#/$defs/')) {
      issues.push({ path: `${path}/$ref`, message: 'A reference must be a local $defs reference' });
    }
  }
  if (schema.required !== undefined && (!Array.isArray(schema.required) || schema.required.some(item => typeof item !== 'string'))) {
    issues.push({ path: `${path}/required`, message: 'A required list holds property names' });
  }
  if (schema.enum !== undefined && (!Array.isArray(schema.enum) || !schema.enum.length)) {
    issues.push({ path: `${path}/enum`, message: 'An enum must hold at least one value' });
  }
  for (const bound of ['minLength', 'maxLength', 'minItems', 'maxItems'] as const) {
    const value = schema[bound];
    if (value !== undefined && (!Number.isSafeInteger(value) || (value as number) < 0)) {
      issues.push({ path: `${path}/${bound}`, message: `${bound} must be a non-negative integer` });
    }
  }
  for (const bound of ['minimum', 'maximum'] as const) {
    const value = schema[bound];
    if (value !== undefined && typeof value !== 'number') {
      issues.push({ path: `${path}/${bound}`, message: `${bound} must be a number` });
    }
  }
  if (schema.properties !== undefined) {
    if (!isRecord(schema.properties)) issues.push({ path: `${path}/properties`, message: 'Properties must be an object' });
    else for (const [name, child] of Object.entries(schema.properties)) schemaIssues(child, `${path}/properties/${name}`, issues, seen);
  }
  if (schema.items !== undefined) schemaIssues(schema.items, `${path}/items`, issues, seen);
  if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== 'boolean') {
    issues.push({ path: `${path}/additionalProperties`, message: 'additionalProperties must be a boolean' });
  }
  if (schema.$defs !== undefined) {
    if (!isRecord(schema.$defs)) issues.push({ path: `${path}/$defs`, message: '$defs must be an object' });
    else for (const [name, child] of Object.entries(schema.$defs)) schemaIssues(child, `${path}/$defs/${name}`, issues, seen);
  }
  seen.delete(schema);
}

/**
 * The issues of a service schema document. An empty list means the document is
 * usable as a wire contract.
 */
export function validateServiceSchemaDocument(value: unknown): ServiceSchemaIssue[] {
  const issues: ServiceSchemaIssue[] = [];
  if (!isRecord(value)) return [{ path: '', message: 'A service schema document must be an object' }];
  for (const key of Object.keys(value)) {
    if (!['input', 'result', 'errorDetails'].includes(key)) {
      issues.push({ path: `/${key}`, message: `A service schema document holds input, result and errorDetails only` });
    }
  }
  for (const key of ['input', 'result', 'errorDetails'] as const) {
    if (value[key] === undefined) {
      issues.push({ path: `/${key}`, message: `${key} is required` });
      continue;
    }
    schemaIssues(value[key], `/${key}`, issues, new Set());
  }
  return issues;
}

/** The issues of one payload against one schema. */
export function validateServicePayload(schema: unknown, value: unknown, path = ''): ServiceSchemaIssue[] {
  const issues: ServiceSchemaIssue[] = [];
  if (!isRecord(schema)) return [{ path, message: 'A schema must be an object' }];
  if (value === undefined || value === null) {
    if (schema.type !== 'null' && schema.type !== undefined) {
      issues.push({ path, message: 'A null value does not match the schema' });
    }
    return issues;
  }
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case 'object': {
      if (!isRecord(value)) { issues.push({ path, message: 'The value must be an object' }); break; }
      const properties = isRecord(schema.properties) ? schema.properties : {};
      for (const name of Array.isArray(schema.required) ? schema.required : []) {
        if (typeof name === 'string' && !(name in value)) issues.push({ path: `${path}/${name}`, message: 'A required property is missing' });
      }
      for (const [name, child] of Object.entries(value)) {
        const childSchema = properties[name];
        if (childSchema === undefined) {
          if (schema.additionalProperties === false) issues.push({ path: `${path}/${name}`, message: 'The property is not declared' });
          continue;
        }
        issues.push(...validateServicePayload(childSchema, child, `${path}/${name}`));
      }
      break;
    }
    case 'array': {
      if (!Array.isArray(value)) { issues.push({ path, message: 'The value must be an array' }); break; }
      if (typeof schema.minItems === 'number' && value.length < schema.minItems) issues.push({ path, message: 'The array is too short' });
      if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) issues.push({ path, message: 'The array is too long' });
      if (schema.items !== undefined) value.forEach((item, index) => issues.push(...validateServicePayload(schema.items, item, `${path}/${index}`)));
      break;
    }
    case 'string': {
      if (typeof value !== 'string') { issues.push({ path, message: 'The value must be a string' }); break; }
      if (typeof schema.minLength === 'number' && value.length < schema.minLength) issues.push({ path, message: 'The string is too short' });
      if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) issues.push({ path, message: 'The string is too long' });
      break;
    }
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) { issues.push({ path, message: 'The value must be a finite number' }); break; }
      if (typeof schema.minimum === 'number' && value < schema.minimum) issues.push({ path, message: 'The number is too small' });
      if (typeof schema.maximum === 'number' && value > schema.maximum) issues.push({ path, message: 'The number is too large' });
      break;
    case 'integer':
      if (!Number.isSafeInteger(value)) { issues.push({ path, message: 'The value must be an integer' }); break; }
      if (typeof schema.minimum === 'number' && (value as number) < schema.minimum) issues.push({ path, message: 'The number is too small' });
      if (typeof schema.maximum === 'number' && (value as number) > schema.maximum) issues.push({ path, message: 'The number is too large' });
      break;
    case 'boolean':
      if (typeof value !== 'boolean') issues.push({ path, message: 'The value must be a boolean' });
      break;
    case 'null':
      if (value !== null) issues.push({ path, message: 'The value must be null' });
      break;
    default:
      break;
  }
  if (Array.isArray(schema.enum) && !schema.enum.some(entry => JSON.stringify(entry) === JSON.stringify(value))) {
    issues.push({ path, message: 'The value is not one of the declared values' });
  }
  return issues;
}

/** The issues of a payload that also has to fit its size limit. */
export function validateServicePayloadSize(value: unknown): ServiceSchemaIssue[] {
  const size = byteLength(value);
  return size > SERVICE_PAYLOAD_LIMIT_BYTES
    ? [{ path: '', message: `A payload is at most ${SERVICE_PAYLOAD_LIMIT_BYTES} bytes` }]
    : [];
}

/**
 * The digest of a schema document. The same document always yields the same
 * digest, and a document whose keys are in another order yields the same digest
 * too, so a grant can be compared with a declaration.
 */
export function serviceSchemaDigest(value: unknown): string {
  const canonical = canonicalize(value);
  return createHash('sha256').update(canonical).digest('hex');
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null) ?? 'null';
}

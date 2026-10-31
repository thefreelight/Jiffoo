import { loadOpenApiSpec, type Operation, type Response } from './openapi';

type JsonSchema = Record<string, any>;

const JSON_MEDIA_TYPE = 'application/json';
const SUCCESS_STATUS_CODES = ['200', '201', '202'] as const;

export function derefSchema(schema: JsonSchema | undefined | null): JsonSchema | undefined {
  if (!schema) return undefined;
  if (!schema.$ref) return schema;
  const spec = loadOpenApiSpec();
  const ref = String(schema.$ref);
  if (!ref.startsWith('#/components/schemas/')) return schema;
  const key = ref.replace('#/components/schemas/', '');
  return (spec.components?.schemas?.[key] as JsonSchema | undefined) || schema;
}

/**
 * The success response of an operation, using the same status-code precedence
 * for every helper in this module: 200, then 201, then 202.
 */
export function getSuccessResponse(operation: Operation): Response | undefined {
  const responses = operation.responses || {};
  for (const status of SUCCESS_STATUS_CODES) {
    const response = responses[status];
    if (response) return response;
  }
  return undefined;
}

/**
 * The media types declared for the success response, normalized to their base
 * type (`text/csv; charset=utf-8` becomes `text/csv`).
 */
export function getSuccessMediaTypes(operation: Operation): string[] {
  const response = getSuccessResponse(operation);
  const content = response?.content;
  if (!content) return [];
  return Object.keys(content)
    .map((mediaType) => mediaType.split(';')[0]!.trim().toLowerCase())
    .filter((mediaType) => mediaType.length > 0);
}

/**
 * True when the declared success payload is a binary body rather than a JSON
 * document. Fastify routes that stream a file answer with the schema
 * `{ type: 'string', format: 'binary' }`, which carries no `success`/`data`
 * envelope and therefore cannot satisfy the rule.
 */
export function isBinarySuccessPayload(operation: Operation): boolean {
  const success = getSuccessResponse(operation);
  const schema = success?.content?.[JSON_MEDIA_TYPE]?.schema as JsonSchema | undefined;
  if (!schema) return false;
  const resolved = derefSchema(schema) || schema;
  return resolved.type === 'string' && resolved.format === 'binary';
}

/**
 * True when the operation's success response is deliberately not a JSON
 * document, so the JSON envelope rule does not apply to it:
 *
 * - it declares at least one content type and none of them is
 *   `application/json` (a CSV export, a plain-text body), or
 * - its only declared content type is `application/json` and that content is
 *   a binary payload (a file download).
 *
 * An operation that declares no success response at all, or that declares a
 * JSON object payload, is not excluded here.
 */
export function hasNonJsonSuccessResponse(operation: Operation): boolean {
  const mediaTypes = getSuccessMediaTypes(operation);
  if (mediaTypes.length === 0) return false;
  if (!mediaTypes.includes(JSON_MEDIA_TYPE)) return true;
  return isBinarySuccessPayload(operation);
}

export function getSuccessSchema(operation: Operation): JsonSchema | undefined {
  const success = getSuccessResponse(operation);
  return derefSchema(success?.content?.[JSON_MEDIA_TYPE]?.schema as JsonSchema | undefined);
}

export function isTypedDataSchema(dataSchema: JsonSchema | undefined): boolean {
  if (!dataSchema) return false;
  const schema = derefSchema(dataSchema) || dataSchema;
  if (schema.oneOf || schema.anyOf || schema.allOf || schema.$ref) return true;
  if (schema.type === 'object') {
    const props = schema.properties ? Object.keys(schema.properties) : [];
    return props.length > 0
      || Object.prototype.hasOwnProperty.call(schema, 'additionalProperties')
      || Object.prototype.hasOwnProperty.call(schema, 'patternProperties');
  }
  return Object.keys(schema).length > 0;
}

/**
 * The violations of the JSON success envelope rule for a single operation.
 *
 * Three cases are distinguished:
 * 1. no success response is declared at all -> violation, the rule is never
 *    weakened into "skip whatever is undeclared";
 * 2. the success response declares only non-JSON media types -> not a
 *    violation, the operation answers a body that is deliberately not JSON;
 * 3. the success response declares `application/json` -> the envelope must
 *    require `success` and `data`, `success` must be `enum [true]` and `data`
 *    must be a typed schema.
 */
export function successEnvelopeViolations(path: string, method: string, operation: Operation): string[] {
  const violations: string[] = [];
  const successResponse = getSuccessResponse(operation);
  if (!successResponse) return [`${method} ${path}: missing success response`];
  if (hasNonJsonSuccessResponse(operation)) return violations;
  const successSchema = getSuccessSchema(operation);
  if (!successSchema) return [`${method} ${path}: missing application/json success schema`];
  const required = new Set(successSchema.required || []);
  if (!required.has('success') || !required.has('data')) {
    violations.push(`${method} ${path}: success response must require success and data`);
  }
  const successProp = successSchema.properties?.success;
  if (!successProp || !Array.isArray(successProp.enum) || successProp.enum[0] !== true) {
    violations.push(`${method} ${path}: success property should be enum [true]`);
  }
  const dataSchema = derefSchema(successSchema.properties?.data as JsonSchema | undefined);
  if (!isTypedDataSchema(dataSchema)) violations.push(`${method} ${path}: data schema is untyped`);
  return violations;
}

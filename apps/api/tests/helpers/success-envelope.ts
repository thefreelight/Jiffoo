import { loadOpenApiSpec, type Operation } from './openapi';

type JsonSchema = Record<string, any>;

export function derefSchema(schema: JsonSchema | undefined | null): JsonSchema | undefined {
  if (!schema) return undefined;
  if (!schema.$ref) return schema;
  const spec = loadOpenApiSpec();
  const ref = String(schema.$ref);
  if (!ref.startsWith('#/components/schemas/')) return schema;
  const key = ref.replace('#/components/schemas/', '');
  return (spec.components?.schemas?.[key] as JsonSchema | undefined) || schema;
}

export function getSuccessSchema(operation: Operation): JsonSchema | undefined {
  const responses = operation.responses || {};
  const success = responses['200'] || responses['201'] || responses['202'];
  return derefSchema(success?.content?.['application/json']?.schema as JsonSchema | undefined);
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

export function successEnvelopeViolations(path: string, method: string, operation: Operation): string[] {
  const violations: string[] = [];
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

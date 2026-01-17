/**
 * OpenAPI Helper for Tests
 * 
 * Provides utilities for:
 * - Loading and parsing OpenAPI spec
 * - Validating responses against schemas
 * - Extracting operation metadata
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';
import path from 'path';

// Load OpenAPI spec
const openapiPath = path.resolve(__dirname, '../../openapi.json');
let openApiSpec: OpenAPISpec | null = null;

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
}

export interface Operation {
  summary?: string;
  description?: string;
  tags?: string[];
  security?: Array<Record<string, string[]>>;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
}

export interface Parameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required?: boolean;
  schema: any;
}

export interface RequestBody {
  content: Record<string, { schema: any }>;
  required?: boolean;
}

export interface Response {
  description: string;
  content?: Record<string, { schema: any }>;
}

/**
 * Load OpenAPI specification
 */
export function loadOpenApiSpec(): OpenAPISpec {
  if (!openApiSpec) {
    const content = fs.readFileSync(openapiPath, 'utf-8');
    openApiSpec = JSON.parse(content);
  }
  return openApiSpec!;
}

/**
 * Get all operations from OpenAPI spec
 */
export function getAllOperations(): Array<{
  path: string;
  method: string;
  operation: Operation;
  operationId: string;
}> {
  const spec = loadOpenApiSpec();
  const operations: Array<{
    path: string;
    method: string;
    operation: Operation;
    operationId: string;
  }> = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;
    
    for (const method of methods) {
      const operation = pathItem[method];
      if (operation) {
        operations.push({
          path,
          method: method.toUpperCase(),
          operation,
          operationId: `${method.toUpperCase()} ${path}`,
        });
      }
    }
  }

  return operations;
}

/**
 * Get operations by tag
 */
export function getOperationsByTag(tag: string): ReturnType<typeof getAllOperations> {
  return getAllOperations().filter(op => 
    op.operation.tags?.includes(tag)
  );
}

/**
 * Get operations that require authentication
 */
export function getAuthenticatedOperations(): ReturnType<typeof getAllOperations> {
  return getAllOperations().filter(op => 
    op.operation.security && op.operation.security.length > 0
  );
}

/**
 * Get operations that don't require authentication
 */
export function getPublicOperations(): ReturnType<typeof getAllOperations> {
  return getAllOperations().filter(op => 
    !op.operation.security || op.operation.security.length === 0
  );
}

/**
 * Check if an operation requires authentication
 */
export function requiresAuth(path: string, method: string): boolean {
  const spec = loadOpenApiSpec();
  const pathItem = spec.paths[path];
  if (!pathItem) return false;
  
  const operation = pathItem[method.toLowerCase() as keyof PathItem];
  if (!operation) return false;
  
  return !!(operation.security && operation.security.length > 0);
}

/**
 * Get response schema for an operation
 */
export function getResponseSchema(path: string, method: string, statusCode: number | string): any {
  const spec = loadOpenApiSpec();
  const pathItem = spec.paths[path];
  if (!pathItem) return null;
  
  const operation = pathItem[method.toLowerCase() as keyof PathItem];
  if (!operation) return null;
  
  const response = operation.responses[String(statusCode)];
  if (!response?.content?.['application/json']?.schema) return null;
  
  return response.content['application/json'].schema;
}

/**
 * Create AJV validator
 */
function createValidator(): Ajv {
  const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    strict: false,
  });
  addFormats(ajv);
  return ajv;
}

/**
 * Validate response against OpenAPI schema
 */
export function validateResponse(
  path: string,
  method: string,
  statusCode: number,
  responseBody: any
): { valid: boolean; errors?: any[] } {
  const schema = getResponseSchema(path, method, statusCode);
  
  if (!schema) {
    // No schema defined - consider valid
    return { valid: true };
  }

  const ajv = createValidator();
  const validate = ajv.compile(schema);
  const valid = validate(responseBody);

  return {
    valid: !!valid,
    errors: validate.errors || undefined,
  };
}

/**
 * Get request body schema for an operation
 */
export function getRequestBodySchema(path: string, method: string): any {
  const spec = loadOpenApiSpec();
  const pathItem = spec.paths[path];
  if (!pathItem) return null;
  
  const operation = pathItem[method.toLowerCase() as keyof PathItem];
  if (!operation?.requestBody?.content?.['application/json']?.schema) return null;
  
  return operation.requestBody.content['application/json'].schema;
}

/**
 * Get all unique tags from OpenAPI spec
 */
export function getAllTags(): string[] {
  const operations = getAllOperations();
  const tags = new Set<string>();
  
  for (const op of operations) {
    if (op.operation.tags) {
      op.operation.tags.forEach(tag => tags.add(tag));
    }
  }
  
  return Array.from(tags).sort();
}

/**
 * Get operation count statistics
 */
export function getOperationStats(): {
  total: number;
  byMethod: Record<string, number>;
  byTag: Record<string, number>;
  authenticated: number;
  public: number;
} {
  const operations = getAllOperations();
  
  const byMethod: Record<string, number> = {};
  const byTag: Record<string, number> = {};
  
  for (const op of operations) {
    // Count by method
    byMethod[op.method] = (byMethod[op.method] || 0) + 1;
    
    // Count by tag
    const tags = op.operation.tags || ['(no-tag)'];
    for (const tag of tags) {
      byTag[tag] = (byTag[tag] || 0) + 1;
    }
  }
  
  return {
    total: operations.length,
    byMethod,
    byTag,
    authenticated: getAuthenticatedOperations().length,
    public: getPublicOperations().length,
  };
}

/**
 * Print operation summary (for debugging)
 */
export function printOperationSummary(): void {
  const stats = getOperationStats();
  
  console.log('\n📊 OpenAPI Operation Summary\n');
  console.log(`Total Operations: ${stats.total}`);
  console.log(`Authenticated: ${stats.authenticated}`);
  console.log(`Public: ${stats.public}`);
  
  console.log('\nBy Method:');
  for (const [method, count] of Object.entries(stats.byMethod)) {
    console.log(`  ${method}: ${count}`);
  }
  
  console.log('\nBy Tag:');
  for (const [tag, count] of Object.entries(stats.byTag)) {
    console.log(`  ${tag}: ${count}`);
  }
}

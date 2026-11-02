/**
 * The client generator of the core-mediated plugin service contract.
 *
 * A provider publishes the schema of every method it exports in its signed
 * package. A consumer that calls one of those methods compiles against the
 * schema, so the schema has to reach the consumer without a shared runtime:
 * the generator reads the verified package and emits a types-only declaration
 * plus a typed wrapper whose runtime delegates exclusively to
 * `ctx.services.call`.
 *
 * The generated file carries the provider slug, the service, the exact service
 * major and the schema digest, so a consumer can tell which contract it
 * compiled against. The runtime still validates the schema and the permission
 * of every call; the generated types are a convenience, never an authority.
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getPluginManifestIssues } from '../../shared/src/extensions/plugin-contract';
import { serviceSchemaDigest, validateServiceSchemaDocument } from '../../shared/src/extensions/service-schema';
import { readPluginZipEntries, verifyPluginZip } from '../../shared/src/plugin-signing';

/** The options of the generation. */
export interface GenerateClientOptions {
  /** The verified provider package. */
  packagePath: string;
  /** The service the consumer calls. */
  service: string;
  /** The exact service major. */
  version: number;
  /** The provider slug; the manifest of the package names it by default. */
  provider?: string;
}

/** The generated client and the contract it was generated from. */
export interface GeneratedClient {
  provider: string;
  service: string;
  version: number;
  /** The digest of the schema of the service. */
  schemaDigest: string;
  /** The generated TypeScript declaration and wrapper. */
  source: string;
}

interface ServiceMethod {
  name: string;
  idempotencyRequired: boolean;
  schema: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The name of a generated type: the service and the method, in camel case. */
function typeName(parts: string[]): string {
  return parts
    .flatMap(part => part.split(/[^a-zA-Z0-9]+/))
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join('');
}

/** The rendering of one schema. */
interface RenderContext {
  defs: Record<string, unknown>;
  used: Set<string>;
}

function renderSchema(schema: unknown, context: RenderContext): string {
  if (!isRecord(schema)) return 'unknown';
  if (typeof schema.$ref === 'string') {
    const name = schema.$ref.replace('#/$defs/', '');
    context.used.add(name);
    return typeName([name]);
  }
  if (Array.isArray(schema.enum) && schema.enum.length) {
    return schema.enum.map(value => JSON.stringify(value)).join(' | ');
  }
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (type) {
    case 'object': {
      const properties = isRecord(schema.properties) ? schema.properties : {};
      const required = new Set(Array.isArray(schema.required) ? schema.required.filter((name): name is string => typeof name === 'string') : []);
      const entries = Object.entries(properties).map(([name, child]) => {
        const rendered = renderSchema(child, context);
        const optional = required.has(name) ? '' : '?';
        const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
        return `  ${key}${optional}: ${rendered};`;
      });
      return entries.length ? `{\n${entries.join('\n')}\n}` : 'Record<string, unknown>';
    }
    case 'array': {
      const item = renderSchema(schema.items, context);
      return /[|&\s]/.test(item) ? `Array<${item}>` : `${item}[]`;
    }
    case 'string': return 'string';
    case 'number': return 'number';
    case 'integer': return 'number';
    case 'boolean': return 'boolean';
    case 'null': return 'null';
    default: return 'unknown';
  }
}

/** The declaration of one payload of a method. */
function renderPayload(name: string, schema: unknown, context: RenderContext): string {
  const rendered = renderSchema(schema, context);
  return rendered.startsWith('{\n') ? `export interface ${name} ${rendered}\n` : `export type ${name} = ${rendered};\n`;
}

/**
 * Generates the client of one service of a verified provider package.
 *
 * The package is verified with the same verifier the upload uses: a package
 * whose signature does not hold is refused.
 */
export async function generateServiceClient(options: GenerateClientOptions): Promise<GeneratedClient> {
  const bytes = await fs.readFile(path.resolve(options.packagePath));
  const publisher = await verifyPluginZip(bytes);
  const entries = readPluginZipEntries(bytes);
  const wrapped = entries.filter(entry => /^[^/]+\/manifest\.json$/.test(entry.path));
  const manifestEntry = entries.find(entry => entry.path === 'manifest.json')
    ?? (wrapped.length === 1 ? wrapped[0] : undefined);
  if (!manifestEntry) throw new Error('The package holds no manifest.json');
  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestEntry.content.toString('utf8'));
  } catch {
    throw new Error('The manifest of the package is not valid JSON');
  }
  const issues = getPluginManifestIssues(manifest);
  if (issues.length) throw new Error(`The manifest of the package is invalid: ${issues.map(issue => issue.path).join(', ')}`);
  const root = manifestEntry.path.slice(0, -'manifest.json'.length);
  const files = new Map(entries
    .filter(entry => !entry.path.endsWith('/'))
    .map(entry => [root && entry.path.startsWith(root) ? entry.path.slice(root.length) : entry.path, entry.content]));
  const declared = (manifest as { services?: Array<{ name?: unknown; version?: unknown; methods?: unknown }> }).services ?? [];
  const service = declared.find(candidate => candidate.name === options.service && candidate.version === options.version);
  if (!service) throw new Error(`The package does not export ${options.service} v${options.version}`);
  const rawMethods: unknown[] = Array.isArray(service.methods) ? service.methods : [];
  const methods: ServiceMethod[] = rawMethods.flatMap((entry) => {
    const method = (entry ?? {}) as { name?: unknown; schema?: unknown; idempotencyRequired?: unknown };
    const name = method.name;
    const schema = method.schema;
    const idempotencyRequired = method.idempotencyRequired;
    if (typeof name !== 'string' || typeof schema !== 'string' || typeof idempotencyRequired !== 'boolean') return [];
    return [{ name, schema, idempotencyRequired }];
  });
  if (!methods.length) throw new Error(`The package exports no method of ${options.service} v${options.version}`);

  const provider = options.provider ?? (manifest as { slug?: unknown }).slug;
  if (typeof provider !== 'string' || !provider) throw new Error('The package names no provider slug');

  const prefix = typeName([options.service]);
  const context: RenderContext = { defs: {}, used: new Set<string>() };
  const payloads: string[] = [];
  const schemaDigests: string[] = [];
  let needsRandomKey = false;
  for (const method of methods) {
    const content = files.get(method.schema);
    if (!content) throw new Error(`The package holds no schema ${method.schema}`);
    let document: unknown;
    try {
      document = JSON.parse(content.toString('utf8'));
    } catch {
      throw new Error(`The schema ${method.schema} is not valid JSON`);
    }
    const schemaIssues = validateServiceSchemaDocument(document);
    if (schemaIssues.length) throw new Error(`The schema ${method.schema} is invalid: ${schemaIssues.map(issue => issue.path).join(', ')}`);
    schemaDigests.push(`${method.schema}=${serviceSchemaDigest(document)}`);
    const methodName = typeName([options.service, method.name]);
    const parts = document as { input?: unknown; result?: unknown; errorDetails?: unknown };
    for (const [suffix, schema] of [['Input', parts.input], ['Result', parts.result], ['ErrorDetails', parts.errorDetails]] as const) {
      if (isRecord(schema) && isRecord(schema.$defs)) {
        for (const [name, definition] of Object.entries(schema.$defs)) {
          if (!(name in context.defs)) context.defs[name] = definition;
        }
      }
      payloads.push(renderPayload(`${methodName}${suffix}`, schema, context));
    }
    if (!method.idempotencyRequired) needsRandomKey = true;
  }
  // The definitions are rendered until no new name appears: a definition may
  // reference another definition.
  const definitions: string[] = [];
  const rendered = new Set<string>();
  const queue = [...context.used].sort();
  while (queue.length) {
    const name = queue.shift()!;
    if (rendered.has(name)) continue;
    rendered.add(name);
    definitions.push(renderPayload(typeName([name]), context.defs[name], context));
    for (const used of context.used) if (!rendered.has(used)) queue.push(used);
  }
  const schemaDigest = createHash('sha256').update(schemaDigests.sort().join('\n'), 'utf8').digest('hex').slice(0, 32);

  const clientName = `${prefix}Client`;
  const signatures = methods.map(method => {
    const methodName = typeName([options.service, method.name]);
    const optionsType = method.idempotencyRequired
      ? '{ idempotencyKey: string; timeoutMs?: number }'
      : '{ idempotencyKey?: string; timeoutMs?: number }';
    return `  ${method.name}(input: ${methodName}Input, options: ${optionsType}): Promise<ServiceResult<${methodName}Result>>;`;
  });
  const body = methods.map(method => {
    const methodName = typeName([options.service, method.name]);
    const optionsType = method.idempotencyRequired
      ? '{ idempotencyKey: string; timeoutMs?: number }'
      : '{ idempotencyKey?: string; timeoutMs?: number }';
    // A method that requires an idempotent outcome takes the key of the
    // caller: a generated key would make a retry a second effect.
    const key = method.idempotencyRequired ? 'options.idempotencyKey' : 'options.idempotencyKey ?? randomUUID()';
    return `    async ${method.name}(input: ${methodName}Input, options: ${optionsType}) {
      return ctx.services.call({
        plugin: ${JSON.stringify(provider)},
        service: ${JSON.stringify(options.service)},
        version: ${options.version},
        method: ${JSON.stringify(method.name)},
        input,
        idempotencyKey: ${key},
        timeoutMs: options.timeoutMs,
      }) as Promise<ServiceResult<${methodName}Result>>;
    },`;
  });
  const imports = [
    "import type { PluginContext, ServiceResult } from '@jiffoo-core/plugin-sdk';",
    ...(needsRandomKey ? ["import { randomUUID } from 'node:crypto';"] : []),
  ];
  // The trust of the package is part of the header: a consumer compiles
  // against the schemas of a package whose publisher it must be able to see.
  const trust = publisher
    ? `signed by ${publisher.publisherName || publisher.publisherId} (${publisher.signingRoot})`
    : 'unsigned package; the publisher is not verified';
  const source = `// Generated by jiffoo-plugin services generate-client. Do not edit; regenerate instead.
// provider: ${provider} | service: ${options.service} | version: ${options.version}
// schema digest: ${schemaDigest}
// package: ${trust}
${imports.join('\n')}

${definitions.join('\n')}${payloads.join('\n')}
export interface ${clientName} {
${signatures.join('\n')}
}

export function ${prefix.toLowerCase()}Client(ctx: PluginContext): ${clientName} {
  return {
${body.join('\n')}
  };
}
`;
  return { provider, service: options.service, version: options.version, schemaDigest, source };
}

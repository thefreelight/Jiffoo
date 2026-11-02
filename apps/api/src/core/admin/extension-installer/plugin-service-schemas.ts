import { serviceSchemaDigest } from '@jiffoo/shared';
import { ApiError } from '@/utils/api-errors';
import type { PluginManifest } from '@/core/extensions/shared/types';

/**
 * The schemas of the services a provider update may not change.
 *
 * A consumer compiles against the schema of the method it calls. A provider
 * that changes the schema of a version a consumer still uses breaks that
 * consumer, so the update is refused while the version is required; the
 * provider publishes a new version instead.
 */

/** The declaration of one method of one service. */
interface MethodDeclaration {
  name: string;
  schema: string;
}

function declarationsOf(manifest: unknown): Map<string, MethodDeclaration> {
  const declared = new Map<string, MethodDeclaration>();
  const services = (manifest as { services?: Array<{ name?: unknown; version?: unknown; methods?: unknown }> } | null)?.services;
  if (!Array.isArray(services)) return declared;
  for (const service of services) {
    if (typeof service?.name !== 'string' || !Number.isSafeInteger(service?.version)) continue;
    if (!Array.isArray(service.methods)) continue;
    for (const method of service.methods) {
      const name = (method as { name?: unknown })?.name;
      const schema = (method as { schema?: unknown })?.schema;
      if (typeof name !== 'string' || typeof schema !== 'string') continue;
      declared.set(`${service.name}.v${service.version}.${name}`, { name, schema });
    }
  }
  return declared;
}

/**
 * Refuses a provider update that changes the schema of a required method.
 *
 * The digests are compared per method: the schema of a method that no enabled
 * dependent calls may change, because nothing compiled against it.
 */
export async function assertProviderSchemasUnchanged(input: {
  slug: string;
  version: string;
  required: Array<{ service: string; version: number; methods: string[] }>;
  oldManifest: unknown;
  newManifest: PluginManifest;
  oldPackage: { readText(relativePath: string): Promise<string> } | null;
  newFiles: Map<string, Buffer>;
}): Promise<void> {
  if (!input.required.length) return;
  const oldDeclarations = declarationsOf(input.oldManifest);
  const newDeclarations = declarationsOf(input.newManifest);
  const changed: string[] = [];
  for (const requirement of input.required) {
    for (const method of requirement.methods) {
      const key = `${requirement.service}.v${requirement.version}.${method}`;
      const oldDeclaration = oldDeclarations.get(key);
      const newDeclaration = newDeclarations.get(key);
      if (!newDeclaration) {
        changed.push(`${key} is no longer exported; publish a new version and let the consumers move to it first`);
        continue;
      }
      const newDigest = digestOfFile(input.newFiles, newDeclaration.schema);
      if (newDigest === null) {
        changed.push(`${key} has no readable schema in the new package`);
        continue;
      }
      if (!oldDeclaration) continue;
      const oldDigest = await digestOf(input.oldPackage, oldDeclaration.schema);
      if (oldDigest === null) continue;
      if (oldDigest !== newDigest) changed.push(`${key} changed its schema`);
    }
  }
  if (!changed.length) return;
  throw new ApiError('PLUGIN_SERVICE_DEPENDENCY_INVALID', {
    reasons: changed.map(reason => `the version ${input.version} of the provider ${input.slug} is refused: ${reason}`),
  });
}

async function digestOf(
  packageFiles: { readText(relativePath: string): Promise<string> } | null,
  relativePath: string,
): Promise<string | null> {
  if (!packageFiles) return null;
  try {
    return serviceSchemaDigest(JSON.parse(await packageFiles.readText(relativePath)));
  } catch {
    return null;
  }
}

function digestOfFile(files: Map<string, Buffer>, relativePath: string): string | null {
  const content = files.get(relativePath);
  if (!content) return null;
  try {
    return serviceSchemaDigest(JSON.parse(content.toString('utf8')));
  } catch {
    return null;
  }
}

import { parsePluginConfigSchema, validatePluginConfig } from '@jiffoo/shared';
import { ExtensionInstallerError } from './errors';

function manifestRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      return manifestRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function evaluatePluginConfigReadiness(
  manifestJson: unknown,
  config: Record<string, unknown> | null | undefined,
) {
  const manifest = manifestRecord(manifestJson);
  if (!manifest || manifest.configSchema === undefined) {
    return { requiresConfiguration: false, ready: true, missingFields: [] as string[] };
  }
  const { schema, issues } = parsePluginConfigSchema(manifest.configSchema);
  if (!schema) throw new Error(`Invalid plugin configSchema: ${issues.map((issue) => issue.path).join(', ')}`);
  const missingFields = validatePluginConfig(schema, config ?? {})
    .filter((issue) => issue.message === 'Required field is missing')
    .map((issue) => issue.path.slice('config.'.length));
  return {
    requiresConfiguration: Boolean(schema.required?.length),
    ready: missingFields.length === 0,
    missingFields,
  };
}

export function assertPluginConfigReadyForEnable(
  slug: string,
  manifestJson: unknown,
  config: Record<string, unknown> | null | undefined,
): void {
  const readiness = evaluatePluginConfigReadiness(manifestJson, config);
  if (readiness.ready) return;
  throw new ExtensionInstallerError(
    `Plugin "${slug}" requires configuration before enabling. Missing required fields: ${readiness.missingFields.join(', ')}`,
    {
      code: 'PLUGIN_CONFIG_REQUIRED',
      statusCode: 400,
      details: { missingFields: readiness.missingFields },
    },
  );
}

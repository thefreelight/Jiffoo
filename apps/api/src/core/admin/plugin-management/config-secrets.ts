type GenericObject = Record<string, unknown>;

export type PluginConfigMeta = {
  secretFields?: Record<string, { configured: boolean }>;
};

function isPlainObject(value: unknown): value is GenericObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonObject(value: unknown): GenericObject {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return isPlainObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return isPlainObject(value) ? value : {};
}

function getConfigSchema(manifestJson: unknown): GenericObject {
  const manifest = parseJsonObject(manifestJson);
  return isPlainObject(manifest.configSchema) ? (manifest.configSchema as GenericObject) : {};
}

function getSecretFields(manifestJson: unknown): string[] {
  const configSchema = getConfigSchema(manifestJson);
  return Object.entries(configSchema)
    .filter(([, descriptor]) => isPlainObject(descriptor) && descriptor.type === 'secret')
    .map(([field]) => field);
}

function hasConfiguredSecretValue(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
}

export function sanitizePluginConfigForAdmin(
  manifestJson: unknown,
  config: Record<string, unknown>
): { config: Record<string, unknown>; configMeta?: PluginConfigMeta } {
  const secretFields = getSecretFields(manifestJson);
  if (secretFields.length === 0) {
    return { config };
  }

  const sanitized = { ...config };
  const secretMeta: Record<string, { configured: boolean }> = {};
  for (const field of secretFields) {
    secretMeta[field] = {
      configured: hasConfiguredSecretValue(config[field]),
    };
    sanitized[field] = '';
  }

  return {
    config: sanitized,
    configMeta: {
      secretFields: secretMeta,
    },
  };
}

export function mergeSecretConfigForUpdate(
  manifestJson: unknown,
  existingConfig: Record<string, unknown>,
  incomingConfig: Record<string, unknown>
): Record<string, unknown> {
  const secretFields = getSecretFields(manifestJson);
  if (secretFields.length === 0) {
    return incomingConfig;
  }

  const merged = { ...incomingConfig };

  for (const field of secretFields) {
    if (!(field in merged)) {
      if (field in existingConfig) {
        merged[field] = existingConfig[field];
      }
      continue;
    }

    const nextValue = merged[field];
    if (nextValue === null) {
      delete merged[field];
      continue;
    }

    if (typeof nextValue === 'string' && nextValue.trim().length === 0 && hasConfiguredSecretValue(existingConfig[field])) {
      merged[field] = existingConfig[field];
    }
  }

  return merged;
}

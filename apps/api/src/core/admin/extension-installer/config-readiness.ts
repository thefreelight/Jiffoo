import { ExtensionInstallerError } from './errors';

type GenericObject = Record<string, unknown>;

interface ConfigReadiness {
  requiresConfiguration: boolean;
  ready: boolean;
  missingFields: string[];
}

function isPlainObject(value: unknown): value is GenericObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseManifest(manifestJson: unknown): GenericObject | null {
  if (!manifestJson) {
    return null;
  }
  if (isPlainObject(manifestJson)) {
    return manifestJson;
  }
  if (typeof manifestJson !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(manifestJson);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizePath(path: string): string {
  return path.replace(/^\./, '');
}

function validateByDescriptor(
  descriptor: GenericObject,
  value: unknown,
  currentPath: string
): string[] {
  const issues: string[] = [];
  const required = Boolean(descriptor.required);
  const valueMissing = value === undefined || value === null;
  const type = typeof descriptor.type === 'string' ? descriptor.type : undefined;
  const enumValues = Array.isArray(descriptor.enum) ? descriptor.enum : undefined;
  const hasProperties = isPlainObject(descriptor.properties);
  const requiredList = Array.isArray(descriptor.required) ? descriptor.required : undefined;

  if (required && valueMissing) {
    issues.push(normalizePath(currentPath));
    return issues;
  }

  if (valueMissing) {
    return issues;
  }

  if (type === 'string') {
    if (typeof value !== 'string' || value.trim().length === 0) {
      issues.push(normalizePath(currentPath));
      return issues;
    }
    if (enumValues && !enumValues.includes(value)) {
      issues.push(normalizePath(currentPath));
      return issues;
    }
    return issues;
  }

  if (type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      issues.push(normalizePath(currentPath));
    }
    return issues;
  }

  if (type === 'boolean') {
    if (typeof value !== 'boolean') {
      issues.push(normalizePath(currentPath));
    }
    return issues;
  }

  if (type === 'array') {
    if (!Array.isArray(value) || value.length === 0) {
      issues.push(normalizePath(currentPath));
    }
    return issues;
  }

  if (type === 'object' || hasProperties || requiredList) {
    if (!isPlainObject(value)) {
      issues.push(normalizePath(currentPath));
      return issues;
    }

    if (!hasProperties && !requiredList) {
      if (Object.keys(value).length === 0 && required) {
        issues.push(normalizePath(currentPath));
      }
      return issues;
    }

    const childProperties = hasProperties ? (descriptor.properties as GenericObject) : {};
    const childRequired = requiredList?.filter((item): item is string => typeof item === 'string') ?? [];
    for (const [childKey, childDescriptorValue] of Object.entries(childProperties)) {
      if (!isPlainObject(childDescriptorValue)) {
        continue;
      }
      const forcedDescriptor: GenericObject = {
        ...childDescriptorValue,
        required: Boolean(childDescriptorValue.required) || childRequired.includes(childKey),
      };
      const childValue = (value as GenericObject)[childKey];
      issues.push(...validateByDescriptor(forcedDescriptor, childValue, `${currentPath}.${childKey}`));
    }
    return issues;
  }

  if (required && typeof value === 'string' && value.trim().length === 0) {
    issues.push(normalizePath(currentPath));
  }

  return issues;
}

function collectRequiredFlags(descriptor: GenericObject): boolean {
  if (Boolean(descriptor.required)) {
    return true;
  }

  if (Array.isArray(descriptor.required) && descriptor.required.length > 0) {
    return true;
  }

  if (isPlainObject(descriptor.properties)) {
    return Object.values(descriptor.properties).some((child) =>
      isPlainObject(child) ? collectRequiredFlags(child) : false
    );
  }

  return false;
}

export function evaluatePluginConfigReadiness(
  manifestJson: unknown,
  config: Record<string, unknown> | null | undefined
): ConfigReadiness {
  const manifest = parseManifest(manifestJson);
  const configSchema = manifest && isPlainObject(manifest.configSchema)
    ? (manifest.configSchema as GenericObject)
    : null;

  if (!configSchema) {
    return {
      requiresConfiguration: false,
      ready: true,
      missingFields: [],
    };
  }

  const missingFields: string[] = [];
  const currentConfig = isPlainObject(config) ? config : {};

  const schemaLooksLikeJsonSchemaObject =
    configSchema.type === 'object' &&
    isPlainObject(configSchema.properties);

  if (schemaLooksLikeJsonSchemaObject) {
    missingFields.push(...validateByDescriptor(configSchema, currentConfig, 'config'));
  } else {
    for (const [key, descriptorValue] of Object.entries(configSchema)) {
      if (!isPlainObject(descriptorValue)) {
        continue;
      }
      const value = currentConfig[key];
      missingFields.push(...validateByDescriptor(descriptorValue, value, key));
    }
  }

  const uniqueMissingFields = Array.from(new Set(missingFields.filter(Boolean)));
  const requiresConfiguration = schemaLooksLikeJsonSchemaObject
    ? collectRequiredFlags(configSchema)
    : Object.values(configSchema).some((descriptorValue) =>
      isPlainObject(descriptorValue) ? collectRequiredFlags(descriptorValue) : false
    );

  return {
    requiresConfiguration,
    ready: !requiresConfiguration || uniqueMissingFields.length === 0,
    missingFields: uniqueMissingFields,
  };
}

export function assertPluginConfigReadyForEnable(
  slug: string,
  manifestJson: unknown,
  config: Record<string, unknown> | null | undefined
): void {
  const readiness = evaluatePluginConfigReadiness(manifestJson, config);
  if (!readiness.requiresConfiguration || readiness.ready) {
    return;
  }

  const missing = readiness.missingFields.join(', ');
  throw new ExtensionInstallerError(
    `Plugin "${slug}" requires configuration before enabling. Missing required fields: ${missing}`,
    {
      code: 'PLUGIN_CONFIG_REQUIRED',
      statusCode: 400,
      details: { missingFields: readiness.missingFields },
    }
  );
}

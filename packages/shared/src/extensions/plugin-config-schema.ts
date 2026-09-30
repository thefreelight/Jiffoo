export type PluginConfigField = {
  type: 'string' | 'integer' | 'number' | 'boolean';
  title?: string;
  description?: string;
  default?: string | number | boolean;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  sensitive?: true;
};

export type PluginConfigSchema = {
  type: 'object';
  properties: Record<string, PluginConfigField>;
  required?: string[];
};

export type PluginConfigIssue = { path: string; message: string };

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parsePluginConfigSchema(value: unknown): {
  schema: PluginConfigSchema | null;
  issues: PluginConfigIssue[];
} {
  const issues: PluginConfigIssue[] = [];
  if (!record(value)) return { schema: null, issues: [{ path: 'configSchema', message: 'configSchema must be an object' }] };
  for (const key of Object.keys(value)) {
    if (!['type', 'properties', 'required'].includes(key)) issues.push({ path: `configSchema.${key}`, message: 'Unknown field' });
  }
  if (value.type !== 'object') issues.push({ path: 'configSchema.type', message: 'Expected object' });
  if (!record(value.properties)) issues.push({ path: 'configSchema.properties', message: 'Expected properties object' });
  const properties = record(value.properties) ? value.properties : {};
  if (value.required !== undefined && (!Array.isArray(value.required)
    || value.required.some((key) => typeof key !== 'string' || !(key in properties))
    || new Set(value.required).size !== value.required.length)) {
    issues.push({ path: 'configSchema.required', message: 'Required fields must be unique declared property names' });
  }
  for (const [name, raw] of Object.entries(properties)) {
    const path = `configSchema.properties.${name}`;
    if (!record(raw)) {
      issues.push({ path, message: 'Expected field descriptor' });
      continue;
    }
    for (const key of Object.keys(raw)) {
      if (!['type', 'title', 'description', 'default', 'enum', 'minimum', 'maximum', 'minLength', 'maxLength', 'sensitive'].includes(key)) {
        issues.push({ path: `${path}.${key}`, message: 'Unknown field' });
      }
    }
    if (!['string', 'integer', 'number', 'boolean'].includes(String(raw.type))) {
      issues.push({ path: `${path}.type`, message: 'Unsupported field type' });
      continue;
    }
    const type = raw.type;
    for (const key of ['title', 'description'] as const) {
      if (raw[key] !== undefined && typeof raw[key] !== 'string') issues.push({ path: `${path}.${key}`, message: 'Expected string' });
    }
    if (raw.sensitive !== undefined && (raw.sensitive !== true || type !== 'string')) {
      issues.push({ path: `${path}.sensitive`, message: 'Only string fields may be sensitive' });
    }
    if (raw.enum !== undefined && (type !== 'string' || !Array.isArray(raw.enum)
      || raw.enum.length === 0 || raw.enum.some((item) => typeof item !== 'string')
      || new Set(raw.enum).size !== raw.enum.length)) {
      issues.push({ path: `${path}.enum`, message: 'Expected unique string options' });
    }
    for (const key of ['minimum', 'maximum', 'minLength', 'maxLength'] as const) {
      if (raw[key] === undefined) continue;
      const length = key === 'minLength' || key === 'maxLength';
      if ((length ? type !== 'string' : type !== 'integer' && type !== 'number')
        || typeof raw[key] !== 'number' || !Number.isFinite(raw[key])
        || (length && (!Number.isInteger(raw[key]) || raw[key] < 0))
        || (!length && type === 'integer' && !Number.isInteger(raw[key]))) {
        issues.push({ path: `${path}.${key}`, message: 'Invalid bound' });
      }
    }
    if (typeof raw.minimum === 'number' && typeof raw.maximum === 'number' && raw.minimum > raw.maximum) issues.push({ path: `${path}.maximum`, message: 'Maximum is below minimum' });
    if (typeof raw.minLength === 'number' && typeof raw.maxLength === 'number' && raw.minLength > raw.maxLength) issues.push({ path: `${path}.maxLength`, message: 'Maximum is below minimum' });
    if (raw.default !== undefined) {
      const field = raw as PluginConfigField;
      if (validatePluginConfigValue(field, raw.default)) issues.push({ path: `${path}.default`, message: 'Invalid default' });
    }
  }
  return { schema: issues.length ? null : value as PluginConfigSchema, issues };
}

function validatePluginConfigValue(field: PluginConfigField, value: unknown): boolean {
  if (field.type === 'string') return typeof value !== 'string'
    || (field.enum !== undefined && !field.enum.includes(value))
    || (field.minLength !== undefined && value.length < field.minLength)
    || (field.maxLength !== undefined && value.length > field.maxLength);
  if (field.type === 'boolean') return typeof value !== 'boolean';
  if (typeof value !== 'number' || !Number.isFinite(value)) return true;
  return (field.type === 'integer' && !Number.isInteger(value))
    || (field.minimum !== undefined && value < field.minimum)
    || (field.maximum !== undefined && value > field.maximum);
}

export function validatePluginConfig(schema: PluginConfigSchema, value: Record<string, unknown>): PluginConfigIssue[] {
  const issues: PluginConfigIssue[] = [];
  for (const name of schema.required ?? []) {
    const field = schema.properties[name];
    if (value[name] === undefined || value[name] === null
      || (field?.type === 'string' && value[name] === '')) {
      issues.push({ path: `config.${name}`, message: 'Required field is missing' });
    }
  }
  for (const [name, current] of Object.entries(value)) {
    const field = schema.properties[name];
    if (!field) {
      issues.push({ path: `config.${name}`, message: 'Unknown field' });
    } else if (current !== undefined && current !== null && validatePluginConfigValue(field, current)) {
      issues.push({ path: `config.${name}`, message: 'Value does not match field constraints' });
    }
  }
  return issues;
}

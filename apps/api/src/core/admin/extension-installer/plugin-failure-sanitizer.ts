import { parsePluginConfigSchema } from '@jiffoo/shared';

export const PLUGIN_FAILURE_MAX_LENGTH = 500;
export const PLUGIN_FAILURE_HIDDEN_MESSAGE = 'Details hidden; may contain sensitive data.';
export type FailureContext = { config: Record<string, unknown>; manifest: { configSchema?: unknown } };

export function sanitizePluginFailure(error: unknown, contexts: FailureContext[] = []): string {
  let message = error instanceof Error ? error.message : String(error);
  const values = new Set<string>();
  for (const { config, manifest } of contexts) {
    if (manifest.configSchema === undefined) continue;
    const { schema } = parsePluginConfigSchema(manifest.configSchema);
    if (!schema) return PLUGIN_FAILURE_HIDDEN_MESSAGE;
    for (const [field, descriptor] of Object.entries(schema.properties)) {
      if (!descriptor.sensitive || config[field] === undefined || config[field] === null) continue;
      const value = String(config[field]);
      if (value) values.add(value);
    }
  }
  if ([...values].some(value => value.length < 4 && message.includes(value))) return PLUGIN_FAILURE_HIDDEN_MESSAGE;
  for (const value of [...values].sort((a, b) => b.length - a.length)) message = message.replaceAll(value, '***');
  message = message.split(/\r?\n/).filter(line => !/^\s*(?:at\s+|Traceback\b|File\s+".*",\s+line\b|\.\.\.\s+\d+\s+more)/.test(line)).join(' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, '').trim();
  if ([...values].some(value => value.length < 4 && message.includes(value))) return PLUGIN_FAILURE_HIDDEN_MESSAGE;
  for (const value of [...values].sort((a, b) => b.length - a.length)) message = message.replaceAll(value, '***');
  message = message.replace(/\benc:v\d+:[A-Za-z0-9_:=-]+/g, '***')
    .replace(/\bAuthorization\s*[:=]\s*(?:(?:Bearer|Basic)\s+)?[^\s"'<>;,]+/gi, 'Authorization: ***')
    .replace(/\bBearer\s+[^\s"'<>;,]+/gi, 'Bearer ***')
    .replace(/\b([\w.-]*(?:key|token|secret|password)[\w.-]*)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s&,;<>]+)/gi, '$1=***');
  return Array.from(message).slice(0, PLUGIN_FAILURE_MAX_LENGTH).join('');
}

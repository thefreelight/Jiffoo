import { merchant } from '../../../../packages/shared/src/i18n/messages/en/merchant';
export function translate(key: string, values?: Record<string, string | number>) {
  let value: unknown = { merchant };
  for (const part of key.split('.')) value = (value as Record<string, unknown> | undefined)?.[part];
  return typeof value === 'string' ? value.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? `{${name}}`)) : key;
}

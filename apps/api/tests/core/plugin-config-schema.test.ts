import { describe, expect, it } from 'vitest';
import { parsePluginConfigSchema, validatePluginConfig } from '@jiffoo/shared';

describe('plugin config schema subset', () => {
  const valid = {
    type: 'object',
    properties: {
      text: { type: 'string', title: 'Text', description: 'Description', default: 'a', minLength: 1, maxLength: 9, enum: ['a', 'b'], sensitive: true },
      count: { type: 'integer', default: 2, minimum: 1, maximum: 10 },
      price: { type: 'number', default: 0.5, minimum: 0, maximum: 2 },
      enabled: { type: 'boolean', default: false },
    },
    required: ['text'],
  };

  it('accepts every supported type and keyword and validates values', () => {
    const { schema, issues } = parsePluginConfigSchema(valid);
    expect(issues).toEqual([]);
    expect(schema).not.toBeNull();
    expect(validatePluginConfig(schema!, { text: 'a', count: 2, price: 0.5, enabled: false })).toEqual([]);
  });

  it.each([
    [{ text: { type: 'string' } }, 'configSchema.type'],
    [{ type: 'object', properties: {}, extra: true }, 'configSchema.extra'],
    [{ type: 'object', properties: { x: { type: 'array' } } }, 'configSchema.properties.x.type'],
    [{ type: 'object', properties: { x: { type: 'string', items: [] } } }, 'configSchema.properties.x.items'],
    [{ type: 'object', properties: { x: { type: 'number', minLength: 1 } } }, 'configSchema.properties.x.minLength'],
    [{ type: 'object', properties: { x: { type: 'boolean', sensitive: true } } }, 'configSchema.properties.x.sensitive'],
    [{ type: 'object', properties: { x: { type: 'string', default: 1 } } }, 'configSchema.properties.x.default'],
    [{ type: 'object', properties: { x: { type: 'integer', minimum: 2, default: 1 } } }, 'configSchema.properties.x.default'],
    [{ type: 'object', properties: { x: { type: 'string', enum: ['a'], default: 'b' } } }, 'configSchema.properties.x.default'],
    [{ type: 'object', properties: { x: { type: 'string' } }, required: ['missing'] }, 'configSchema.required'],
  ])('rejects unsupported schema constructs at %s', (input, path) => {
    expect(parsePluginConfigSchema(input).issues).toContainEqual(expect.objectContaining({ path }));
  });
});

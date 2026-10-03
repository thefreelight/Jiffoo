import { describe, expect, it } from 'vitest';
import { sanitizePluginFailure, PLUGIN_FAILURE_HIDDEN_MESSAGE, PLUGIN_FAILURE_MAX_LENGTH } from '@/core/admin/extension-installer/plugin-failure-sanitizer';

const context = (value: string) => [{ config: { credential: value }, manifest: { configSchema: { type: 'object', properties: { credential: { type: 'string', sensitive: true } } } } }];
describe('Last recorded error sanitizer', () => {
  it('A replaces every occurrence of declared long sensitive values', () => { expect(sanitizePluginFailure('long-value twice long-value', context('long-value'))).toBe('*** twice ***'); });
  it.each(['x', 'xy', 'xyz'])('A hides the whole message when short sensitive value %s is present', value => {
    expect(sanitizePluginFailure(`failure ${value}`, context(value))).toBe(PLUGIN_FAILURE_HIDDEN_MESSAGE);
    expect(sanitizePluginFailure('failure', context(value))).toBe('failure');
  });
  it('A redacts encrypted envelopes, Authorization, Bearer and common credential pairs', () => {
    const message = sanitizePluginFailure('enc:v1:12345678:abcd:efgh:ijkl Authorization: Bearer alpha Bearer beta key=gamma token="delta space" secret=epsilon password=zeta api_key=eta');
    for (const value of ['enc:v1', 'alpha', 'beta', 'gamma', 'delta space', 'epsilon', 'zeta', 'eta']) expect(message).not.toContain(value);
    expect(message).toContain('***');
  });
  it('A removes stack lines and control characters including bidi formatting', () => {
    expect(sanitizePluginFailure('failure\u0000\u001b\u202e\n    at handler (C:/plugin/index.js:1:1)\nnext line')).toBe('failure next line');
  });
  it('A redacts secrets revealed by removing control characters', () => { expect(sanitizePluginFailure('long-\u0000value', context('long-value'))).toBe('***'); });
  it('A caps output at 500 Unicode characters and never uses an exception stack', () => {
    const error = new Error('\u{10400}'.repeat(510)); error.stack = 'raw stack secret';
    expect(Array.from(sanitizePluginFailure(error))).toHaveLength(PLUGIN_FAILURE_MAX_LENGTH); expect(sanitizePluginFailure(error)).not.toContain('raw stack');
  });
});

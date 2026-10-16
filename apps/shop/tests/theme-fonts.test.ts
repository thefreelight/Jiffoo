import { expect, it } from 'vitest';
import { shopFontTokens } from '../lib/theme-fonts';

it('resolves system defaults without mutating the theme or replacing merchant fonts', () => {
  const tokens = { core: { 'font-body': 'system-sans', 'font-heading': 'brand', 'font-mono': 'system-mono' }, extras: {} };
  expect(shopFontTokens(tokens)).toEqual({ core: { 'font-body': 'geist', 'font-heading': 'brand', 'font-mono': 'geist-mono' }, extras: {} });
  expect(tokens.core['font-body']).toBe('system-sans');
  expect(shopFontTokens({ core: { 'font-body': 'system-serif' } })).toEqual({ core: { 'font-body': 'system-serif' } });
});

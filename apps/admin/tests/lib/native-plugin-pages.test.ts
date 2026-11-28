import { describe, expect, it } from 'vitest';
import { NATIVE_PLUGIN_PAGES, nativePluginPage } from '../../lib/native-plugin-pages/registry';

describe('admin pages compiled into the build', () => {
  it('has none in the open-source build', () => {
    expect(Object.keys(NATIVE_PLUGIN_PAGES)).toEqual([]);
    expect(nativePluginPage('anything')).toBeUndefined();
  });

  it('gives the page of a plugin the build listed, and nothing for the others', () => {
    const page = () => null;
    NATIVE_PLUGIN_PAGES['listed-plugin'] = page;
    try {
      expect(nativePluginPage('listed-plugin')).toBe(page);
      expect(nativePluginPage('other-plugin')).toBeUndefined();
    } finally {
      delete NATIVE_PLUGIN_PAGES['listed-plugin'];
    }
  });

  it('does not mistake a property of every object for a page', () => {
    expect(nativePluginPage('toString')).toBeUndefined();
    expect(nativePluginPage('constructor')).toBeUndefined();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRemoteThemeRuntime } from '@/lib/themes/remote-runtime';

function installRuntimeScriptInterceptor(runtimeFactory: () => unknown) {
  const originalAppendChild = document.head.appendChild.bind(document.head);
  return vi.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
    const appended = originalAppendChild(node);
    if (node instanceof HTMLScriptElement) {
      queueMicrotask(() => {
        window.__JIFFOO_THEME_RUNTIME__ = runtimeFactory();
        node.onload?.call(node, new Event('load'));
      });
    }
    return appended;
  });
}

function runtimePayload(version: string) {
  return {
    meta: {
      slug: 'modelsfind',
      version,
      target: 'shop',
    },
    components: {},
  };
}

describe('remote theme runtime identity', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.head.innerHTML = '';
    window.__JIFFOO_THEME_RUNTIME__ = undefined;
  });

  it('accepts a runtime bundle whose metadata matches the active installed theme', async () => {
    installRuntimeScriptInterceptor(() => runtimePayload('0.1.4'));

    await expect(loadRemoteThemeRuntime({
      cacheKey: 'runtime:modelsfind:0.1.4:identity-ok',
      url: '/extensions/themes/shop/.versions/modelsfind/0.1.4/runtime/theme-runtime.js?v=0.1.4',
      expectedIdentity: {
        slug: 'modelsfind',
        version: '0.1.4',
        target: 'shop',
      },
    })).resolves.toMatchObject({
      meta: {
        slug: 'modelsfind',
        version: '0.1.4',
        target: 'shop',
      },
    });
  });

  it('rejects a runtime bundle whose metadata version is stale', async () => {
    installRuntimeScriptInterceptor(() => runtimePayload('0.1.3'));

    await expect(loadRemoteThemeRuntime({
      cacheKey: 'runtime:modelsfind:0.1.4:identity-stale',
      url: '/extensions/themes/shop/.versions/modelsfind/0.1.4/runtime/theme-runtime.js?v=0.1.4',
      expectedIdentity: {
        slug: 'modelsfind',
        version: '0.1.4',
        target: 'shop',
      },
    })).rejects.toThrow('Theme runtime version mismatch');
    expect(window.__JIFFOO_THEME_RUNTIME__).toBeUndefined();
  });

  it('revalidates cached runtimes when the caller supplies an expected identity', async () => {
    installRuntimeScriptInterceptor(() => runtimePayload('0.1.3'));

    await expect(loadRemoteThemeRuntime({
      cacheKey: 'runtime:modelsfind:0.1.4:identity-cache-bypass',
      url: '/extensions/themes/shop/.versions/modelsfind/0.1.4/runtime/theme-runtime.js?v=0.1.4',
    })).resolves.toMatchObject({
      meta: {
        version: '0.1.3',
      },
    });

    await expect(loadRemoteThemeRuntime({
      cacheKey: 'runtime:modelsfind:0.1.4:identity-cache-bypass',
      url: '/extensions/themes/shop/.versions/modelsfind/0.1.4/runtime/theme-runtime.js?v=0.1.4',
      expectedIdentity: {
        slug: 'modelsfind',
        version: '0.1.4',
        target: 'shop',
      },
    })).rejects.toThrow('Theme runtime version mismatch');
  });
});

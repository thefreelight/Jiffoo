import { afterEach, expect, it, vi } from 'vitest';
import { StorefrontCodeLoader } from '../components/storefront-code-loader';

const state = vi.hoisted(() => ({ effects: [] as Array<() => void>, initialize: vi.fn(), initialized: vi.fn() }));
vi.mock('react', () => ({ useEffect: (effect: () => void) => state.effects.push(effect) }));
vi.mock('../lib/storefront-providers', () => ({ initializeProviders: state.initialize }));
vi.mock('../lib/purchase-tracking', () => ({ documentTracking: () => ({ initialized: state.initialized }) }));

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); state.effects.length = 0; vi.clearAllMocks(); });

it('initializes once after load even when the browser never has an idle period', async () => {
  vi.useFakeTimers();
  let loaded: (() => void) | undefined;
  vi.stubGlobal('document', { readyState: 'loading', body: { firstChild: null }, head: {},
    write: vi.fn(), writeln: vi.fn(), createElement: () => ({ content: { childNodes: [] }, innerHTML: '' }) });
  vi.stubGlobal('window', {
    addEventListener: (_event: string, callback: () => void) => { loaded = callback; },
    // A busy browser runs idle work only when its requested deadline expires.
    requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => {
      if (options?.timeout !== undefined) return setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), options.timeout);
      return 0;
    },
  });
  const slots = { ga4MeasurementId: null, metaPixelId: null, baiduSiteKey: null, headCode: '', bodyStartCode: '', bodyEndCode: '' };
  StorefrontCodeLoader({ slots, libraryOverrides: {} });
  state.effects[0]();
  await vi.advanceTimersByTimeAsync(5000);
  expect(state.initialize).not.toHaveBeenCalled();
  loaded!();
  await vi.advanceTimersByTimeAsync(1000);
  expect(state.initialize).toHaveBeenCalledExactlyOnceWith(slots, {});
  expect(state.initialized).toHaveBeenCalledExactlyOnceWith(slots);
  state.effects[0]();
  await vi.advanceTimersByTimeAsync(5000);
  expect(state.initialize).toHaveBeenCalledTimes(1);
});

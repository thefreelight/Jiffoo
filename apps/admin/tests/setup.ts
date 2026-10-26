import { afterEach, beforeEach } from 'vitest';

/**
 * jsdom does not implement `ResizeObserver`, but Radix components measure themselves
 * through it: the fulfilment policy switches of the settings page render a Radix
 * switch, whose bubble input reads the control size through `useSize`. In a browser
 * the observer always exists, so the gap belongs to the test environment.
 *
 * The stub below reports the size jsdom gives every element (zero) once per observed
 * element, so the component reads a valid entry instead of throwing and nothing spins.
 * It is installed before every test and removed again afterwards, so no test inherits
 * the stub of another one.
 */

type MeasuredBox = { inlineSize: number; blockSize: number };

type ResizeObserverEntryLike = {
  target: Element;
  contentRect: { x: number; y: number; top: number; left: number; right: number; bottom: number; width: number; height: number };
  borderBoxSize: MeasuredBox[];
  contentBoxSize: MeasuredBox[];
  devicePixelContentBoxSize: MeasuredBox[];
};

type ResizeObserverCallbackLike = (entries: ResizeObserverEntryLike[], observer: TestResizeObserver) => void;

function measure(target: Element): ResizeObserverEntryLike {
  const element = target as HTMLElement;
  const width = typeof element.offsetWidth === 'number' ? element.offsetWidth : 0;
  const height = typeof element.offsetHeight === 'number' ? element.offsetHeight : 0;
  const box: MeasuredBox = { inlineSize: width, blockSize: height };
  return {
    target,
    contentRect: { x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height },
    borderBoxSize: [box],
    contentBoxSize: [box],
    devicePixelContentBoxSize: [box],
  };
}

class TestResizeObserver {
  private readonly callback: ResizeObserverCallbackLike;
  private readonly observed = new Set<Element>();

  constructor(callback: ResizeObserverCallbackLike) {
    this.callback = callback;
  }

  observe(target: Element): void {
    this.observed.add(target);
    this.callback([measure(target)], this);
  }

  unobserve(target: Element): void {
    this.observed.delete(target);
  }

  disconnect(): void {
    this.observed.clear();
  }
}

const pristine = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');

function install(): void {
  Object.defineProperty(globalThis, 'ResizeObserver', { value: TestResizeObserver, configurable: true, writable: true });
}

function uninstall(): void {
  if (pristine) Object.defineProperty(globalThis, 'ResizeObserver', pristine);
  else delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
}

beforeEach(() => {
  // Only the jsdom environment has a DOM to measure; the node environment keeps its own globals.
  if (typeof document === 'undefined') return;
  install();
});

afterEach(() => {
  if (typeof document === 'undefined') return;
  uninstall();
});

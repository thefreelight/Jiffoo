'use client';

import { useEffect } from 'react';
import type { StorefrontCode, StorefrontCodeSlots } from '@/lib/storefront-code';
import { initializeProviders, type ProviderLibraryOverrides } from '@/lib/storefront-providers';
import { documentTracking } from '@/lib/purchase-tracking';

type CodeDocument = Document & { jiffooStorefrontCodeStarted?: boolean };

async function insertNode(node: Node, parent: Node, before: Node | null): Promise<void> {
  if (node instanceof Element && node.localName === 'script') {
    const script = document.createElement('script');
    for (const attribute of node.attributes) script.setAttribute(attribute.name, attribute.value);
    script.textContent = node.textContent;
    const blocking = script.hasAttribute('src') && !script.hasAttribute('async');
    if (blocking) script.async = false;
    const finished = blocking ? new Promise<void>((resolve) => {
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => resolve(), { once: true });
    }) : null;
    parent.insertBefore(script, before);
    if (finished) await finished;
    return;
  }
  const children = [...node.childNodes];
  for (const child of children) node.removeChild(child);
  parent.insertBefore(node, before);
  for (const child of children) await insertSafely(child, node, null);
}

async function insertSafely(node: Node, parent: Node, before: Node | null) {
  try {
    await insertNode(node, parent, before);
  } catch {
    // Merchant mutations or insertion errors must not prevent later nodes from running.
  }
}

async function injectCode(slots: StorefrontCodeSlots) {
  const firstBodyChild = document.body.firstChild;
  const write = document.write;
  const writeln = document.writeln;
  document.write = () => { console.warn('Storefront code blocked document.write'); };
  document.writeln = () => { console.warn('Storefront code blocked document.writeln'); };
  try {
    for (const [code, parent, before] of [
      [slots.headCode, document.head, null],
      [slots.bodyStartCode, document.body, firstBodyChild],
      [slots.bodyEndCode, document.body, null],
    ] as const) {
      const template = document.createElement('template');
      template.innerHTML = code;
      for (const node of [...template.content.childNodes]) await insertSafely(node, parent, before);
    }
  } finally {
    document.write = write;
    document.writeln = writeln;
  }
}

export function StorefrontCodeLoader({ slots, libraryOverrides }: {
  slots: StorefrontCode;
  libraryOverrides: ProviderLibraryOverrides;
}) {
  useEffect(() => {
    const codeDocument = document as CodeDocument;
    if (codeDocument.jiffooStorefrontCodeStarted) return;
    codeDocument.jiffooStorefrontCodeStarted = true;
    // Match next/script lazyOnload timing, including its idle callback fallback.
    const requestIdleCallback = window.requestIdleCallback?.bind(window) || ((callback: IdleRequestCallback) => {
      const start = Date.now();
      return window.setTimeout(() => {
        callback({
          didTimeout: false,
          timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
        });
      }, 1);
    });
    const startInjection = () => {
      requestIdleCallback(() => {
        initializeProviders(slots, libraryOverrides);
        documentTracking().initialized(slots);
        void injectCode(slots);
      });
    };
    if (document.readyState === 'complete') startInjection();
    else window.addEventListener('load', startInjection);
  }, [slots, libraryOverrides]);
  return null;
}

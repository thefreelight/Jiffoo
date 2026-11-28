'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Same-origin through the storefront proxy in production, or the API's own
// origin on a self-hosted shop. The path is deliberately unlike the ones
// tracker-blocking filter lists match (/api/events, /umami.js, /matomo.php).
const COLLECT_URL = `${(process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/+$/, '')}/v1/traffic/collect`;

interface NavigatorFlags {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
  webdriver?: boolean;
}

/** A visitor who asked not to be tracked is left alone, and so is an automated browser. */
export function visitorOptsOut(flags: NavigatorFlags): boolean {
  return flags.doNotTrack === '1' || flags.globalPrivacyControl === true || flags.webdriver === true;
}

export interface PageviewInput {
  hostname: string;
  path: string;
  search: string;
  /** Where the page load came from; only the first page view of a page load carries it. */
  referrer: string | null;
  width: number;
  zoneOffsetMinutes: number;
}

/**
 * What the beacon says about one page view: where it happened and, on a
 * landing page, where it came from. The Core API reads the UTM tags and click
 * ids off the address and keeps neither them nor any identifier from here.
 */
export function buildPageview(input: PageviewInput): Record<string, unknown> {
  const beacon: Record<string, unknown> = {
    v: 1,
    h: input.hostname,
    p: `${input.path}${input.search}`,
    w: input.width,
    z: input.zoneOffsetMinutes,
  };
  if (input.referrer) beacon.r = input.referrer;
  return beacon;
}

/**
 * Counts a page view on load and on every client-side navigation. It carries
 * no identity: the server derives an anonymous visitor key from the request,
 * so there is no cookie, no storage and nothing to clean up.
 */
export function StorefrontTracker() {
  const pathname = usePathname();
  const seen = useRef<{ url: string; landingSent: boolean }>({ url: '', landingSent: false });

  useEffect(() => {
    if (!pathname || visitorOptsOut(navigator)) return;
    const search = window.location.search;
    const url = `${pathname}${search}`;
    // React Strict Mode runs effects twice in development; a page view is still one.
    if (seen.current.url === url) return;
    const landing = !seen.current.landingSent;
    seen.current = { url, landingSent: true };
    const beacon = buildPageview({
      hostname: window.location.hostname,
      path: pathname,
      search,
      // After an in-page navigation document.referrer still names the
      // original document, so it is only ever read for the landing page view.
      referrer: landing ? document.referrer || null : null,
      width: window.innerWidth,
      zoneOffsetMinutes: -new Date().getTimezoneOffset(),
    });
    try {
      void fetch(COLLECT_URL, {
        method: 'POST',
        body: JSON.stringify(beacon),
        headers: { 'content-type': 'text/plain' },
        keepalive: true,
        credentials: 'omit',
      }).catch(() => undefined);
    } catch {
      // Counting a page view is never worth breaking the page for.
    }
  }, [pathname]);

  return null;
}

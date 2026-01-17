/**
 * React Scan Integration
 * 
 * Automatically detects and highlights performance issues in React apps.
 * Only loads in development environment.
 * 
 * @see https://react-scan.com/
 */

'use client';

import Script from 'next/script';

const isDev = process.env.NODE_ENV === 'development';

export function ReactScan() {
  if (!isDev) {
    return null;
  }

  return (
    <Script
      src="https://unpkg.com/react-scan/dist/auto.global.js"
      strategy="afterInteractive"
    />
  );
}

export default ReactScan;

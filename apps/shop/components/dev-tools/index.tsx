/**
 * Development Tools
 * 
 * Contains development-only tools for debugging and performance monitoring.
 * These components only render in development environment.
 */

'use client';

import dynamic from 'next/dynamic';

const isDev = process.env.NODE_ENV === 'development';

// Dynamically import ReactScan only in development to avoid build issues
const ReactScan = isDev
  ? dynamic(() => import('./react-scan').then((mod) => mod.ReactScan), {
      ssr: false,
    })
  : null;

/**
 * DevTools component
 * 
 * Renders all development tools in one place.
 * Only renders in development environment.
 * 
 * Includes:
 * - React Scan: Detects unnecessary re-renders
 * - React Grab: Browser extension for React debugging (requires extension)
 */
export function DevTools() {
  if (!isDev || !ReactScan) {
    return null;
  }

  return (
    <>
      {/* React Scan - Detects performance issues and re-renders */}
      <ReactScan />

      {/* 
        React Grab - Browser Extension
        Install from: https://github.com/nicolo-ribaudo/react-grab
        No code integration needed, just install the extension.
        
        Features:
        - Inspect React component hierarchy
        - View props and state
        - Debug component updates
      */}
    </>
  );
}

export default DevTools;

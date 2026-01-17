/**
 * Development Tools
 * 
 * Contains development-only tools for debugging and performance monitoring.
 * These components only render in development environment.
 */

'use client';

import { ReactScan } from './react-scan';

const isDev = process.env.NODE_ENV === 'development';

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
  if (!isDev) {
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

export { ReactScan };
export default DevTools;

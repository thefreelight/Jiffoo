/**
 * Browser Global Variables Type Declaration - For compilation in Node.js environment

 */

declare global {
  // These variables may not exist in Node.js environment
  var window: {
    addEventListener: (event: string, handler: Function) => void;
    location: { href: string };
    navigator: { userAgent: string; onLine: boolean; sendBeacon?: Function };
    performance?: {
      getEntriesByType: (type: string) => any[];
    };
  } | undefined;

  var document: {
    addEventListener: (event: string, handler: Function) => void;
    hidden: boolean;
    visibilityState: string;
  } | undefined;

  var navigator: {
    userAgent: string;
    onLine: boolean;
    sendBeacon?: (url: string, data: string) => boolean;
  } | undefined;

  var performance: {
    getEntriesByType: (type: any) => any[];
  } | undefined;

  var localStorage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  } | undefined;

  interface PerformanceNavigationTiming {
    loadEventEnd: number;
    fetchStart: number;
    domContentLoadedEventEnd: number;
  }
}

export { };
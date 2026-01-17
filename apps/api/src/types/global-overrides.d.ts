/**
 * Global Type Overrides
 * Used to resolve type conflicts with third-party libraries
 */

// Completely override Pino's type definitions to accept arbitrary arguments
declare module 'pino' {
  interface Logger {
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    info: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    trace: (...args: any[]) => void;
    fatal: (...args: any[]) => void;
  }

  interface BaseLogger {
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    info: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    trace: (...args: any[]) => void;
    fatal: (...args: any[]) => void;
  }
}

// Override Fastify's logger type
declare module 'fastify' {
  interface FastifyBaseLogger {
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    info: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    trace: (...args: any[]) => void;
    fatal: (...args: any[]) => void;
  }
}

// Ensure this file is treated as a module
export { };

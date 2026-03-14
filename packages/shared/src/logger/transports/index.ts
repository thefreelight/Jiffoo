/**
 * Unified Logging System - Transport Module Exports (Node.js version)
 * Note: For browser environment, use index.browser.ts
 */

// Console Transport
export { 
  ConsoleTransport, 
  createConsoleTransport,
  type ConsoleTransportOptions 
} from './console-transport';

// Remote Transport
export { 
  RemoteTransport, 
  createRemoteTransport,
  type RemoteTransportOptions 
} from './remote-transport';

// File Transport (Node.js only)
export { 
  FileTransport, 
  createFileTransport,
  createErrorFileTransport,
  createCombinedFileTransport,
  type FileTransportOptions 
} from './file-transport';

// Transport Factory (Node.js version)
export { createTransport, createDefaultConsoleTransport, createDefaultFileTransports, createDefaultRemoteTransport, type TransportType } from './transport-factory';
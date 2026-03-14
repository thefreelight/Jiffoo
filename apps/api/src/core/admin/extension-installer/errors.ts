export class ExtensionInstallerError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      code?: string;
      details?: unknown;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = 'ExtensionInstallerError';
    this.statusCode = options?.statusCode ?? 400;
    this.code = options?.code ?? 'BAD_REQUEST';
    this.details = options?.details;
    if (options?.cause !== undefined) {
      (this as any).cause = options.cause;
    }
  }
}


import { ApiError, type ErrorCode } from '@/utils/api-errors';

export class ExtensionInstallerError extends ApiError {
  details?: unknown;

  constructor(
    message: string,
    options: {
      statusCode?: number;
      code: ErrorCode;
      details?: unknown;
      cause?: unknown;
    }
  ) {
    super(options.code, options.details);
    this.message = message;
    this.name = 'ExtensionInstallerError';
    this.details = options?.details;
    if (options?.cause !== undefined) {
      (this as any).cause = options.cause;
    }
  }
}


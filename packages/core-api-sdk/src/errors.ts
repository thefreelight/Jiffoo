export type CoreApiErrorInfo = {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  requestId?: string | null;
};

export class CoreApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string | null;

  constructor(info: CoreApiErrorInfo) {
    super(info.message);
    this.name = 'CoreApiError';
    this.status = info.status;
    this.code = info.code;
    this.details = info.details;
    this.requestId = info.requestId ?? null;
  }
}

export function isCoreApiError(error: unknown): error is CoreApiError {
  return error instanceof CoreApiError;
}


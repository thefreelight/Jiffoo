import { ZodError } from 'zod';

export interface MappedRouteError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

interface MapRouteErrorOptions {
  defaultStatus: number;
  defaultCode: string;
  defaultMessage: string;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) {
      return message;
    }
  }
  return fallback;
}

function toErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') {
      return code;
    }
  }
  return undefined;
}

function mapZodError(error: ZodError): MappedRouteError {
  return {
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: {
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code.toUpperCase(),
      })),
    },
  };
}

export function mapAccountRouteError(
  error: unknown,
  options: MapRouteErrorOptions
): MappedRouteError {
  if (error instanceof ZodError) {
    return mapZodError(error);
  }

  const message = toErrorMessage(error, options.defaultMessage);
  const lowerMessage = message.toLowerCase();
  const rawCode = toErrorCode(error);

  if (rawCode === 'P2025' || lowerMessage.includes('user not found') || lowerMessage.includes('record to update not found')) {
    return { status: 404, code: 'NOT_FOUND', message: 'User not found' };
  }

  if (lowerMessage.includes('current password is incorrect') || lowerMessage.includes('invalid password')) {
    return { status: 400, code: 'INVALID_PASSWORD', message: 'Current password is incorrect' };
  }

  if (lowerMessage.includes('email is already in use') || lowerMessage.includes('email already exists')) {
    return { status: 400, code: 'EMAIL_TAKEN', message: 'Email is already in use' };
  }

  if (
    lowerMessage.includes('no file uploaded') ||
    lowerMessage.includes('invalid file type') ||
    lowerMessage.includes('file too large') ||
    lowerMessage.includes('upload failed')
  ) {
    return { status: 400, code: 'VALIDATION_ERROR', message };
  }

  return {
    status: options.defaultStatus,
    code: options.defaultCode,
    message,
  };
}

export function mapAdminOrderRouteError(
  error: unknown,
  options: MapRouteErrorOptions
): MappedRouteError {
  if (error instanceof ZodError) {
    return mapZodError(error);
  }

  const message = toErrorMessage(error, options.defaultMessage);
  const lowerMessage = message.toLowerCase();
  const rawCode = toErrorCode(error);

  if (rawCode === 'P2025' || lowerMessage.includes('order not found')) {
    return { status: 404, code: 'NOT_FOUND', message: 'Order not found' };
  }

  if (
    lowerMessage.includes('cannot ship order with status') ||
    lowerMessage.includes('order is not paid, cannot refund') ||
    lowerMessage.includes('no successful payment found for this order') ||
    lowerMessage.includes('cannot cancel order with status') ||
    lowerMessage.includes('order is already cancelled')
  ) {
    return { status: 400, code: 'VALIDATION_ERROR', message };
  }

  return {
    status: options.defaultStatus,
    code: options.defaultCode,
    message,
  };
}


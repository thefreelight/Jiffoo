/**
 * Contract error types of the plugin gateway.
 *
 * These are the neutral error shapes a commerce module needs in order to talk
 * to a plugin contract. They live outside the admin layer so that a caller
 * never has to import `core/admin/extension-installer` to name an error.
 */

import { ApiError, type ErrorCode } from '@/utils/api-errors';

export type PluginGatewayErrorCode =
  | 'PLUGIN_NOT_FOUND'
  | 'PLUGIN_MANIFEST_MISMATCH'
  | 'PLUGIN_DISABLED'
  | 'INSTANCE_NOT_FOUND'
  | 'INSTANCE_DISABLED'
  | 'PLUGIN_INVALID_MANIFEST'
  | 'PLUGIN_LOAD_FAILED'
  | 'PLUGIN_PACKAGE_UNAVAILABLE'
  | 'PLUGIN_REINSTALL_REQUIRED'
  | 'PLUGIN_TEST_SIGNING_DISABLED'
  | 'PLUGIN_TIMEOUT'
  | 'INVALID_SLUG'
  | 'INVALID_INSTANCE_KEY';

export class PluginGatewayError extends ApiError {
  constructor(message: string, code: PluginGatewayErrorCode, statusCode: number) {
    super(code);
    this.message = message;
  }
}

export class ContractCallError extends ApiError {
  constructor(code: ErrorCode, internalMessage: string) { super(code); this.message = internalMessage; }
}

export function contractGatewayError(error: PluginGatewayError): ContractCallError {
  const code = error.code === 'PLUGIN_NOT_FOUND' || error.code === 'INSTANCE_NOT_FOUND' ? 'PLUGIN_NOT_FOUND'
    : error.code === 'INSTANCE_DISABLED' ? 'PLUGIN_DISABLED'
      : error.code === 'PLUGIN_TIMEOUT' ? 'PLUGIN_TIMEOUT' : 'CONTRACT_CALL_FAILED';
  return new ContractCallError(code, error.message);
}

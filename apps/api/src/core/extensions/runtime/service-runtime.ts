import type {
  ProviderHandler, ProviderInvocation, ServiceResult,
} from '@jiffoo/shared';
import {
  SERVICE_CODE_PATTERN, SERVICE_ERROR_LIMIT_BYTES, SERVICE_MESSAGE_LIMIT,
  serviceSchemaDigest, validateServicePayload, validateServicePayloadSize,
  validateServiceSchemaDocument,
} from '@jiffoo/shared';

/**
 * The core-mediated plugin service contract.
 *
 * A provider plugin registers its methods; a consumer plugin calls them through
 * Core. The call is an in-process invocation of the provider's handler, guarded
 * by the provider's declaration and by the merchant's grant. A provider's
 * business rejection is a result, never an exception: the source discriminator
 * is what keeps a provider from impersonating a Core error.
 */

export interface ServiceMethodSchemas {
  input: unknown;
  result: unknown;
  errorDetails: unknown;
}

/** The default and the bounds of a service call's own budget. */
export const SERVICE_CALL_DEFAULT_TIMEOUT_MS = 30_000;
export const SERVICE_CALL_MIN_TIMEOUT_MS = 1;
export const SERVICE_CALL_MAX_TIMEOUT_MS = 30_000;
/** How deep a service call may nest before Core refuses it. */
export const SERVICE_CALL_MAX_DEPTH = 8;

export interface ServiceMethodRegistration {
  service: string;
  version: number;
  method: string;
  handler: ProviderHandler;
  schemas: ServiceMethodSchemas;
  idempotencyRequired: boolean;
}

export type ServiceRegistrationTable = Map<string, ServiceMethodRegistration>;

/**
 * The permission a merchant grants for one method of one provider.
 *
 * The registry owns the name of the grant, so the grant the merchant gives and
 * the grant the runtime checks are the same string: the registry reads the
 * declarations of both sides of a service call.
 */
export { servicePermission } from '@/core/extensions/registry';

export function serviceKey(service: string, version: number, method: string): string {
  return `${service}.v${version}.${method}`;
}

const providerRegistrations = new Map<string, ServiceRegistrationTable>();

export function publishServiceRegistrations(installationId: string, registrations: ServiceRegistrationTable): void {
  providerRegistrations.set(installationId, registrations);
}

export function clearServiceRegistrations(installationId: string): void {
  providerRegistrations.delete(installationId);
}

export function serviceRegistrationsOf(installationId: string): ServiceRegistrationTable | undefined {
  return providerRegistrations.get(installationId);
}

/**
 * Registers one provider method. The registration has to match the manifest's
 * declaration exactly: the declared service, the declared version and the
 * declared method, with the declared schema.
 */
export function registerServiceMethod(
  registrations: ServiceRegistrationTable,
  declaration: { service: string; version: number; method: string; idempotencyRequired: boolean; schemas: ServiceMethodSchemas },
  handler: ProviderHandler,
): void {
  const key = serviceKey(declaration.service, declaration.version, declaration.method);
  if (registrations.has(key)) throw new Error(`Duplicate service registration ${key}`);
  if (typeof handler !== 'function') throw new Error(`Service ${key} requires a handler`);
  const issues = validateServiceSchemaDocument(declaration.schemas);
  if (issues.length) throw new Error(`Service ${key} declares an invalid schema: ${issues[0].path} ${issues[0].message}`);
  registrations.set(key, {
    service: declaration.service,
    version: declaration.version,
    method: declaration.method,
    handler,
    schemas: declaration.schemas,
    idempotencyRequired: declaration.idempotencyRequired,
  });
}

/** The digest of a method's schema, for the grant record. */
export function serviceDeclarationDigest(schemas: ServiceMethodSchemas): string {
  return serviceSchemaDigest(schemas);
}

/** The provider's business rejection, in the shape that passes through unchanged. */
export function serviceBusinessError(error: { code: string; message: string; details?: unknown }): {
  ok: false; source: 'provider'; error: { code: string; message: string; details: unknown };
} {
  const code = typeof error?.code === 'string' ? error.code : '';
  if (!SERVICE_CODE_PATTERN.test(code)) throw new Error('A business error code must match [A-Z][A-Z0-9_]{0,63}');
  const message = typeof error?.message === 'string' ? error.message : '';
  if (!message || message.length > SERVICE_MESSAGE_LIMIT) throw new Error(`A business error message is 1 to ${SERVICE_MESSAGE_LIMIT} characters`);
  const details = error.details ?? null;
  const size = Buffer.byteLength(JSON.stringify(details) ?? '', 'utf8');
  if (size > SERVICE_ERROR_LIMIT_BYTES) throw new Error(`A business error is at most ${SERVICE_ERROR_LIMIT_BYTES} bytes`);
  return { ok: false, source: 'provider', error: { code, message, details } };
}

/** A Core refusal. It never carries the provider's shape. */
export function serviceCoreError(code: string, message: string, details?: unknown): ServiceResult<never> {
  return { ok: false, source: 'core', error: details === undefined ? { code, message } : { code, message, details } };
}

/** The provider's outcome, checked against its declared schemas. */
export function providerOutcomeToResult(outcome: unknown, schemas: ServiceMethodSchemas): ServiceResult<unknown> {
  if (!outcome || typeof outcome !== 'object' || Array.isArray(outcome)) {
    return serviceCoreError('PLUGIN_SERVICE_PROVIDER_CRASHED', 'The provider returned an invalid outcome');
  }
  const value = outcome as { ok?: unknown; data?: unknown; error?: unknown; outcome?: unknown };
  if (value.ok === true) {
    const size = validateServicePayloadSize(value.data);
    if (size.length) return serviceCoreError('PLUGIN_SERVICE_PROVIDER_CRASHED', size[0].message);
    const issues = validateServicePayload(schemas.result, value.data);
    if (issues.length) return serviceCoreError('PLUGIN_SERVICE_PROVIDER_CRASHED', 'The provider returned a result that does not match its declared schema');
    return { ok: true, data: value.data };
  }
  if (value.ok === false && value.error && typeof value.error === 'object' && !Array.isArray(value.error)) {
    const error = value.error as { code?: unknown; message?: unknown; details?: unknown };
    if (typeof error.code !== 'string' || !SERVICE_CODE_PATTERN.test(error.code)
      || typeof error.message !== 'string' || !error.message || error.message.length > SERVICE_MESSAGE_LIMIT) {
      return serviceCoreError('PLUGIN_SERVICE_PROVIDER_CRASHED', 'The provider returned an invalid business error');
    }
    const details = error.details ?? null;
    const size = Buffer.byteLength(JSON.stringify(details) ?? '', 'utf8');
    if (size > SERVICE_ERROR_LIMIT_BYTES) return serviceCoreError('PLUGIN_SERVICE_PROVIDER_CRASHED', 'The provider returned an invalid business error');
    const issues = validateServicePayload(schemas.errorDetails, details);
    if (issues.length) return serviceCoreError('PLUGIN_SERVICE_PROVIDER_CRASHED', 'The provider returned a business error that does not match its declared schema');
    return { ok: false, source: 'provider', error: { code: error.code, message: error.message, details } };
  }
  return serviceCoreError('PLUGIN_SERVICE_PROVIDER_CRASHED', 'The provider returned an invalid outcome');
}

/** The invocation Core hands the provider. The caller never supplies it. */
export function providerInvocation(input: {
  callId: string; reconcile: boolean; signal: AbortSignal;
  caller: ProviderInvocation['caller'];
}): ProviderInvocation {
  return Object.freeze({
    callId: input.callId,
    reconcile: input.reconcile,
    signal: input.signal,
    caller: Object.freeze({ ...input.caller }),
  });
}

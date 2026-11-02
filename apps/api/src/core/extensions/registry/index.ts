/**
 * Extension registry barrel.
 *
 * Commerce modules import the read-only provider registry from
 * `@/core/extensions/registry`; the implementation lives in `./service`. The
 * service dependency graph lives in `./service-graph`: the registry is the
 * module that reads the declarations of both sides of a service call.
 */
export * from './service';
export * from './service-graph';

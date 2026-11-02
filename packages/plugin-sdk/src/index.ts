// Runtime capabilities are supplied by Core; this entry point exports authoring types only.
export { TaskPermanentError } from '../../shared/src/extensions/plugin-contract';
export { drainPluginTasks } from './tasks';
// The authoring types a generated service client compiles against. The client
// generator itself is a build-time tool and stays out of this entry point, so
// the browser bundle never reaches the file system.
export type {
  BoundPrincipal,
  PaidOrder,
  PluginCommerce,
  PluginContext,
  PluginServiceCall,
  PluginServices,
  ProviderHandler,
  ProviderInvocation,
  ProviderOutcome,
  ServiceResult,
} from '../../shared/src/extensions/plugin-contract';

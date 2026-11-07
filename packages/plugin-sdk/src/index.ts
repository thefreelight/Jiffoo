// Runtime capabilities are supplied by Core; this entry point exports the authoring types and the
// error classes a plugin raises.
export { TaskPermanentError } from '../../shared/src/extensions/plugin-contract';
// The deliberate rejection of a plugin. A plugin raises it instead of a
// system failure when it refuses a request it understands, and Core keeps its
// code and rolls the transaction back.
export { PluginBusinessError, isPluginBusinessError, PLUGIN_BUSINESS_ERROR } from '../../shared/src/extensions/plugin-contract';
export { drainPluginTasks } from './tasks';
// The authoring types a generated service client compiles against. The client
// generator itself is a build-time tool and stays out of this entry point, so
// the browser bundle never reaches the file system.
export type {
  BoundPrincipal,
  PaidOrder,
  PluginCommerce,
  PurchasableVariant,
  PluginCustomer,
  PluginCustomers,
  PluginContext,
  PluginServiceCall,
  PluginServices,
  ProviderHandler,
  ProviderInvocation,
  ProviderOutcome,
  ServiceResult,
} from '../../shared/src/extensions/plugin-contract';

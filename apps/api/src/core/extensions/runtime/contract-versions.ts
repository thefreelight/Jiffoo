/**
 * Capability contract names and versions.
 *
 * The names and the published versions come from the shared package, so this
 * module only pins the neutral aliases a caller needs.
 */

import { PLUGIN_CONTRACT_VERSIONS, type PluginContractName } from '@jiffoo/shared';

export type ContractName = PluginContractName;

/**
 * The published version of a capability contract.
 *
 * The version is bound to the contract name, so a call that passes the wrong
 * version for a contract does not compile.
 */
export type PluginContractVersion<C extends PluginContractName> = (typeof PLUGIN_CONTRACT_VERSIONS)[C];

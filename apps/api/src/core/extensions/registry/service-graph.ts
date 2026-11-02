import { createHash } from 'node:crypto';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { isPluginManifest, type PluginManifest } from '@jiffoo/shared';
import { PLUGIN_SERVICE_GRAPH_LOCK, lockPluginServiceGraph } from '@/core/shared/locks';

/**
 * The service dependency graph of the plugin registry.
 *
 * A consumer plugin declares the services it calls; a provider plugin declares
 * the services it exports. Core keeps the graph of those declarations: it
 * decides whether a consumer may run, it names the dependents of a provider
 * that is about to be disabled, and it names the version of the graph that a
 * merchant confirmation binds.
 *
 * The graph is a projection of the live installations and their stored
 * manifests. It never reads a plugin's code and never decides a business rule
 * of a plugin: it only knows which provider exports which method.
 */

/** A service a provider exports. */
export interface ServiceGraphExport {
  service: string;
  version: number;
  methods: string[];
}

/** A service a consumer calls. */
export interface ServiceGraphRequirement {
  provider: string;
  service: string;
  version: number;
  methods: string[];
  /** The package range the consumer asks of the provider, when it asks for one. */
  packageRange: string | null;
}

/** One installation of the graph. */
export interface ServiceGraphEntry {
  slug: string;
  installationId: string;
  enabled: boolean;
  /** The package of the installation is removed. */
  deleted: boolean;
  /** The stored manifest of the installation passes the manifest validation. */
  manifestValid: boolean;
  version: string;
  exports: ServiceGraphExport[];
  requires: ServiceGraphRequirement[];
  /** Whether the requirements of the installation are satisfied. */
  satisfied: boolean;
  /** The reasons the requirements are unmet. */
  reasons: string[];
}

/** The graph of the live installations. */
export interface ServiceGraph {
  entries: Map<string, ServiceGraphEntry>;
  /** The installations that cannot run, with the reason of every unmet requirement. */
  unavailable: Map<string, string[]>;
  /** The digest of the graph. A confirmation binds it. */
  revision: string;
}

/** The rows the graph reads. */
export interface ServiceGraphRow {
  id: string;
  pluginSlug: string;
  enabled: boolean;
  plugin: { slug: string; version: string; deletedAt: Date | null; manifestJson: unknown };
}

/**
 * The client the graph reads.
 *
 * The root client and a transaction client both satisfy it: the graph is read
 * inside a lifecycle transaction, so the availability it publishes is the
 * availability of the committed state.
 */
export interface ServiceGraphClient {
  pluginInstallation: {
    findMany(args: {
      where: { instanceKey: string; deletedAt: null };
      select: {
        id: true;
        pluginSlug: true;
        enabled: true;
        plugin: { select: { slug: true; version: true; deletedAt: true; manifestJson: true } };
      };
    }): Promise<ServiceGraphRow[]>;
  };
}

/**
 * The advisory lock every graph decision takes, before the installation rows.
 *
 * The key is shared with the durable-task scheduler: a lifecycle decision and a
 * task claim never interleave.
 */
export const SERVICE_GRAPH_LOCK = PLUGIN_SERVICE_GRAPH_LOCK;

/**
 * Takes the graph lock of a transaction.
 *
 * The lock is taken before the installation rows are locked, so two lifecycle
 * decisions never wait for each other in the wrong order.
 */
export async function lockServiceGraph(tx: { $executeRawUnsafe: (query: string) => Promise<unknown> }): Promise<void> {
  await lockPluginServiceGraph(tx);
}

/**
 * Whether a version satisfies one of the ranges the manifest accepts.
 *
 * The manifest validation accepts `^`, `~`, `>=`, `<=`, `>` and `<` with a
 * three-part version, so the check covers exactly those forms. The caret pins
 * the leftmost non-zero part of the range: `^1.2.3` allows every 1.x, `^0.2.3`
 * allows every 0.2.x and `^0.0.3` allows exactly 0.0.3.
 */
export function satisfiesPackageRange(version: string, range: string): boolean {
  const parsed = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!parsed) return false;
  const operator = /^(?:\^|~|>=|<=|>|<)?/.exec(range)?.[0] ?? '';
  const wanted = range.slice(operator.length).split('.').map(Number);
  if (wanted.length !== 3 || wanted.some(part => !Number.isInteger(part))) return false;
  const target = [Number(parsed[1]), Number(parsed[2]), Number(parsed[3])];
  const compare = (other: number[]): number => target[0] - other[0] || target[1] - other[1] || target[2] - other[2];
  switch (operator) {
    case '^':
      if (target[0] !== wanted[0]) return false;
      if (wanted[0] > 0) return compare(wanted) >= 0;
      if (wanted[1] > 0) return target[1] === wanted[1] && compare(wanted) >= 0;
      return target[1] === 0 && target[2] === wanted[2];
    case '~': return target[0] === wanted[0] && target[1] === wanted[1] && compare(wanted) >= 0;
    case '>=': return compare(wanted) >= 0;
    case '<=': return compare(wanted) <= 0;
    case '>': return compare(wanted) > 0;
    case '<': return compare(wanted) < 0;
    default: return compare(wanted) === 0;
  }
}

/**
 * The permission a merchant grants for one method of one provider.
 *
 * The runtime checks the same permission when a plugin calls the method, so
 * the grant and the call always speak about the same method.
 */
export function servicePermission(provider: string, service: string, version: number, method: string): string {
  return `service:${provider}:${service}.v${version}.${method}`;
}

/** The granted permissions of an installation, as a plain array. */
export function grantedPermissionsOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string');
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * The package range a consumer asks of a provider.
 *
 * The manifest names the dependency by its package name, which may carry a
 * scope. The range of a provider is found under its slug or under the last
 * segment of a scoped package name.
 */
function packageRangeOf(dependencies: Record<string, string>, provider: string): string | null {
  for (const [name, range] of Object.entries(dependencies)) {
    if (name === provider || name.split('/').pop() === provider) return range;
  }
  return null;
}

/** The declarations of a manifest, reduced to what the graph reads. */
export function graphShape(manifest: unknown): { exports: ServiceGraphExport[]; requires: ServiceGraphRequirement[]; valid: boolean } {
  if (!isPluginManifest(manifest)) {
    // A manifest the validation refuses has no readable declarations. Such an
    // installation is never operational: a plugin whose declarations cannot be
    // read must not run against a provider it never named.
    return { exports: [], requires: [], valid: false };
  }
  const dependencies = (manifest.dependencies ?? {}) as Record<string, string>;
  return {
    valid: true,
    exports: (manifest.services ?? []).map(declaration => ({
      service: declaration.name,
      version: declaration.version,
      methods: declaration.methods.map(method => method.name),
    })),
    requires: (manifest.serviceDependencies ?? []).map(declaration => ({
      provider: declaration.plugin,
      service: declaration.service,
      version: declaration.version,
      methods: [...declaration.methods],
      packageRange: packageRangeOf(dependencies, declaration.plugin),
    })),
  };
}

/** The installations of the graph, read from the live packages. */
async function readServiceGraphRows(client: ServiceGraphClient): Promise<ServiceGraphRow[]> {
  return client.pluginInstallation.findMany({
    where: { instanceKey: 'default', deletedAt: null },
    select: {
      id: true,
      pluginSlug: true,
      enabled: true,
      plugin: { select: { slug: true, version: true, deletedAt: true, manifestJson: true } },
    },
  });
}

/**
 * The reasons the requirements of an installation are unmet.
 *
 * A requirement is met when the provider is installed, enabled and not
 * removed, when it exports the service and the version with every method the
 * consumer calls, when its version satisfies the package range the consumer
 * asks for, and when the provider itself can run.
 */
function dependencyReasons(entries: Map<string, ServiceGraphEntry>, slug: string, path: string[]): string[] {
  if (path.includes(slug)) return [`the dependency ${slug} is a cycle`];
  const entry = entries.get(slug);
  if (!entry) return [];
  const reasons: string[] = [];
  const next = [...path, slug];
  for (const requirement of entry.requires) {
    const provider = entries.get(requirement.provider);
    if (!provider || provider.deleted) {
      reasons.push(`the provider ${requirement.provider} is not installed`);
      continue;
    }
    if (!provider.enabled) {
      reasons.push(`the provider ${requirement.provider} is disabled`);
      continue;
    }
    const exported = provider.exports.find(candidate => candidate.service === requirement.service && candidate.version === requirement.version);
    if (!exported) {
      reasons.push(`the provider ${requirement.provider} does not export ${requirement.service}.v${requirement.version}`);
      continue;
    }
    const missing = requirement.methods.filter(method => !exported.methods.includes(method));
    if (missing.length) {
      reasons.push(`the provider ${requirement.provider} does not export ${missing.join(', ')} of ${requirement.service}.v${requirement.version}`);
      continue;
    }
    if (requirement.packageRange && !satisfiesPackageRange(provider.version, requirement.packageRange)) {
      reasons.push(`the version ${provider.version} of the provider ${requirement.provider} does not satisfy ${requirement.packageRange}`);
      continue;
    }
    const providerReasons = dependencyReasons(entries, requirement.provider, next);
    if (providerReasons.length) {
      reasons.push(`the provider ${requirement.provider} is not operational: ${providerReasons[0]}`);
    }
  }
  return reasons;
}

/** The digest of the graph: its declarations and its availability. */
function graphRevision(entries: ServiceGraphEntry[]): string {
  const parts = entries
    .map(entry => [entry.slug, entry.enabled ? '1' : '0', entry.deleted ? '1' : '0', entry.manifestValid ? '1' : '0', entry.version,
      entry.exports.map(exported => `${exported.service}.v${exported.version}:${exported.methods.join(',')}`).join('|'),
      entry.requires.map(requirement => `${requirement.provider}:${requirement.service}.v${requirement.version}:${requirement.methods.join(',')}:${requirement.packageRange ?? ''}`).join('|'),
      entry.satisfied ? '1' : '0',
    ].join(';'));
  return createHash('sha256').update(parts.sort().join('\n'), 'utf8').digest('hex').slice(0, 32);
}

/**
 * The graph of the live installations.
 *
 * The read happens inside the transaction of the caller when it passes one, so
 * the graph is the graph of the state the transaction is about to commit.
 */
export async function serviceGraph(client: ServiceGraphClient = prisma as unknown as ServiceGraphClient): Promise<ServiceGraph> {
  const rows = await readServiceGraphRows(client);
  const entries = new Map<string, ServiceGraphEntry>();
  for (const row of rows) {
    const shape = graphShape(row.plugin.manifestJson);
    entries.set(row.plugin.slug, {
      slug: row.plugin.slug,
      installationId: row.id,
      enabled: row.enabled,
      deleted: Boolean(row.plugin.deletedAt),
      manifestValid: shape.valid,
      version: row.plugin.version,
      exports: shape.exports,
      requires: shape.requires,
      satisfied: true,
      reasons: [],
    });
  }
  const unavailable = new Map<string, string[]>();
  for (const [slug, entry] of entries) {
    const reasons = entry.manifestValid ? dependencyReasons(entries, slug, []) : ['the stored manifest of the plugin is invalid'];
    entry.reasons = reasons;
    entry.satisfied = reasons.length === 0;
    const blocked = entry.deleted
      ? ['the plugin is not installed']
      : !entry.enabled
        ? ['the plugin is disabled']
        : reasons;
    if (blocked.length) unavailable.set(slug, blocked);
  }
  return { entries, unavailable, revision: graphRevision([...entries.values()]) };
}

/** The reasons the installation cannot run, if it cannot. */
export function serviceUnavailableReasons(graph: ServiceGraph, slug: string): string[] {
  return graph.unavailable.get(slug) ?? [];
}

/**
 * The permissions a plugin needs for the services it calls.
 *
 * The list is the merchant's view of a package: every method the plugin calls
 * has its own permission, and there is no wildcard. The permission is the
 * same string the runtime checks when the method is called.
 */
export function declaredServicePermissions(manifest: unknown): string[] {
  const shape = graphShape(manifest);
  const permissions = new Set<string>();
  for (const requirement of shape.requires) {
    for (const method of requirement.methods) {
      permissions.add(servicePermission(requirement.provider, requirement.service, requirement.version, method));
    }
  }
  return [...permissions].sort();
}

/**
 * The digest of a granted declaration.
 *
 * The audit records it, so the grant that the merchant approved can be
 * compared with the grant that is in force later.
 */
export function grantedPermissionDigest(permissions: readonly string[]): string {
  return createHash('sha256').update([...permissions].sort().join('\n'), 'utf8').digest('hex').slice(0, 32);
}

/**
 * The dependents of a provider: the installations that call it, directly or
 * through another dependent.
 */
export function serviceDependents(graph: ServiceGraph, slug: string): string[] {
  const found = new Set<string>();
  const queue = [slug];
  while (queue.length) {
    const current = queue.shift()!;
    for (const [candidate, entry] of graph.entries) {
      if (found.has(candidate)) continue;
      if (!entry.requires.some(requirement => requirement.provider === current)) continue;
      found.add(candidate);
      queue.push(candidate);
    }
  }
  return [...found].sort();
}

/** The enabled dependents of a provider. */
function enabledDependents(graph: ServiceGraph, slug: string): string[] {
  return serviceDependents(graph, slug).filter(dependent => Boolean(graph.entries.get(dependent)?.enabled));
}

/**
 * The services an enabled dependent requires of a provider.
 *
 * The answer is what a provider update has to keep: the service, the version
 * and the methods that its consumers call.
 */
export function requiredServicesOf(
  graph: ServiceGraph,
  provider: string,
): Array<{ service: string; version: number; methods: string[] }> {
  const required = new Map<string, { service: string; version: number; methods: Set<string> }>();
  for (const dependent of enabledDependents(graph, provider)) {
    for (const requirement of graph.entries.get(dependent)?.requires ?? []) {
      if (requirement.provider !== provider) continue;
      const key = `${requirement.service}.v${requirement.version}`;
      const entry = required.get(key) ?? { service: requirement.service, version: requirement.version, methods: new Set<string>() };
      for (const method of requirement.methods) entry.methods.add(method);
      required.set(key, entry);
    }
  }
  return [...required.values()]
    .map(entry => ({ service: entry.service, version: entry.version, methods: [...entry.methods].sort() }))
    .sort((left, right) => left.service.localeCompare(right.service) || left.version - right.version);
}

/**
 * The requirements of an installation that is about to run.
 *
 * The check refuses a missing, disabled, removed or non-operational provider, a
 * missing method, a version outside the package range and a cycle. The merchant
 * grant of every called method is required as well: an activation without the
 * approval of the merchant is not an activation.
 */
export async function assertServiceDependenciesSatisfied(input: {
  slug: string;
  manifest: PluginManifest;
  grantedPermissions: unknown;
  client?: ServiceGraphClient;
}): Promise<void> {
  const graph = await serviceGraph(input.client);
  const entries = new Map(graph.entries);
  // The installation that is about to run joins the graph as it will be.
  const shape = graphShape(input.manifest);
  entries.set(input.slug, {
    slug: input.slug,
    installationId: '',
    enabled: true,
    deleted: false,
    manifestValid: shape.valid,
    version: input.manifest.version,
    exports: shape.exports,
    requires: shape.requires,
    satisfied: true,
    reasons: [],
  });
  const reasons = dependencyReasons(entries, input.slug, []);
  if (reasons.length) {
    throw new ApiError('PLUGIN_SERVICE_DEPENDENCY_INVALID', { reasons });
  }
  const granted = new Set(grantedPermissionsOf(input.grantedPermissions));
  const missing: string[] = [];
  for (const requirement of shape.requires) {
    for (const method of requirement.methods) {
      const permission = servicePermission(requirement.provider, requirement.service, requirement.version, method);
      if (!granted.has(permission)) missing.push(permission);
    }
  }
  if (missing.length) {
    throw new ApiError('PLUGIN_SERVICE_DEPENDENCY_INVALID', { reasons: [`the merchant has not granted ${missing.join(', ')}`] });
  }
}

/**
 * The confirmation a disable of a provider needs.
 *
 * The digest binds the affected dependents and the revision of the graph, so a
 * confirmation that was given for another set of dependents, or for another
 * revision of the graph, is refused.
 */
export async function serviceDisableConfirmation(
  slug: string,
  client?: ServiceGraphClient,
): Promise<{ affected: string[]; digest: string; revision: string }> {
  const graph = await serviceGraph(client);
  const affected = enabledDependents(graph, slug);
  const digest = createHash('sha256')
    .update([slug, graph.revision, ...affected].join('\n'), 'utf8')
    .digest('hex')
    .slice(0, 32);
  return { affected, digest, revision: graph.revision };
}

/**
 * The refusal of a disable that was not confirmed.
 *
 * The merchant has to confirm the dependents that become unavailable, so Core
 * answers with the set and the digest of the confirmation it expects. The
 * digest is bound to the revision of the graph, so the confirmation is checked
 * again under the graph lock before the disable is written.
 */
export async function assertServiceDisableConfirmed(
  slug: string,
  confirmation: string | null | undefined,
  client?: ServiceGraphClient,
): Promise<void> {
  const expected = await serviceDisableConfirmation(slug, client);
  if (!expected.affected.length) return;
  if (!confirmation || confirmation !== expected.digest) {
    throw new ApiError('PLUGIN_SERVICE_DISABLE_CONFIRMATION_REQUIRED', {
      affectedDependents: expected.affected,
      graphRevision: expected.revision,
      confirmation: expected.digest,
    });
  }
}

/**
 * The refusal of an uninstall or a purge that would strand a dependent.
 *
 * A dependent that is enabled needs its provider, even when the provider is
 * unavailable at the moment: the merchant disables the dependent first.
 */
export async function assertNoEnabledDependents(slug: string, client?: ServiceGraphClient): Promise<void> {
  const graph = await serviceGraph(client);
  const enabled = enabledDependents(graph, slug);
  if (!enabled.length) return;
  throw new ApiError('PLUGIN_SERVICE_DEPENDENTS_ENABLED', { affectedDependents: enabled });
}

/**
 * The refusal of a provider update that would strand a dependent.
 *
 * A dependent declares the package range it asks of its provider. A provider
 * version outside that range is refused while the dependent is enabled: the
 * merchant disables the dependent first, or widens the range.
 */
export async function assertProviderUpdateKeepsDependents(
  slug: string,
  version: string,
  client?: ServiceGraphClient,
): Promise<void> {
  const graph = await serviceGraph(client);
  const stranded: string[] = [];
  for (const dependent of enabledDependents(graph, slug)) {
    const entry = graph.entries.get(dependent);
    for (const requirement of entry?.requires ?? []) {
      if (requirement.provider !== slug || !requirement.packageRange) continue;
      if (!satisfiesPackageRange(version, requirement.packageRange)) stranded.push(dependent);
    }
  }
  if (!stranded.length) return;
  throw new ApiError('PLUGIN_SERVICE_DEPENDENCY_INVALID', {
    reasons: [`the version ${version} of the provider ${slug} is outside the range its dependents ask for`],
    affectedDependents: [...new Set(stranded)].sort(),
  });
}

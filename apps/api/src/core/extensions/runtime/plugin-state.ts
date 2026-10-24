type PluginStateReset = (slug: string, installationId?: string) => Promise<void> | void;

const resetters = new Map<string, PluginStateReset>();

export function registerPluginStateReset(name: string, reset: PluginStateReset): void {
  resetters.set(name, reset);
}

export async function resetPluginState(slug: string, installationId?: string): Promise<void> {
  await Promise.all([...resetters.values()].map((reset) => reset(slug, installationId)));
}

export function getRegisteredPluginStateContainers(): string[] {
  return [...resetters.keys()];
}

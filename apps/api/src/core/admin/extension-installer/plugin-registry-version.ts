export async function incrementPluginRegistryVersion(client: any): Promise<void> {
  await client.systemSettings.upsert({
    where: { id: 'system' },
    create: { id: 'system', pluginRegistryVersion: 1 },
    update: { pluginRegistryVersion: { increment: 1 } },
  });
}

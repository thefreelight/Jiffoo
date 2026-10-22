import { systemSettingsService } from '@/core/settings/service';

export async function incrementPluginRegistryVersion(client: any): Promise<void> {
  await systemSettingsService.incrementPluginRegistryVersion(client);
}

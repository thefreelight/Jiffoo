import { evaluatePluginConfigReadiness } from '@/core/admin/extension-installer/config-readiness';
import { isOfficialMarketOnly } from '@/core/admin/extension-installer/official-only';
import { PluginManagementService } from '@/core/admin/plugin-management/service';
import { ThemeManagementService } from '@/core/admin/theme-management/service';
import {
  fetchOfficialArtifactsIndex,
  type OfficialArtifactIndexItem,
} from './official-artifacts-client';

export interface OfficialCatalogItem {
  slug: string;
  name: string;
  kind: 'theme' | 'plugin';
  target?: 'shop' | 'admin';
  version: string;
  author: string;
  description: string;
  category: string;
  deliveryMode: 'package-managed';
  installState: 'not_installed' | 'installed' | 'enabled' | 'active';
  releaseStatus: 'published' | 'catalog-only' | 'offline';
  source: 'builtin' | 'installed' | 'local-zip' | 'official-market' | 'catalog';
  availableInMarket: boolean;
  installedVersion?: string | null;
  latestVersion?: string | null;
  artifactPackageUrl?: string | null;
  updateAvailable?: boolean;
  configRequired?: boolean;
  configReady?: boolean;
  missingConfigFields?: string[];
}

export interface OfficialCatalogResponse {
  items: OfficialCatalogItem[];
  marketOnline: boolean;
  marketError?: string;
  officialMarketOnly: boolean;
  generatedAt: string;
}

function toCatalogSource(source: unknown): OfficialCatalogItem['source'] {
  return source === 'builtin' || source === 'installed' || source === 'local-zip' || source === 'official-market'
    ? source
    : 'catalog';
}

export async function getOfficialCatalog(): Promise<OfficialCatalogResponse> {
  const [artifacts, themes, plugins] = await Promise.all([
    fetchOfficialArtifactsIndex().catch(() => []),
    ThemeManagementService.getInstalledThemes('shop'),
    PluginManagementService.getAllPluginPackages(),
  ]);
  const installedThemes = new Map(themes.items.map((theme) => [theme.slug, theme]));
  const installedPlugins = new Map(plugins.map((plugin) => [plugin.slug, plugin]));
  const items = await Promise.all(artifacts.map(async (artifact: OfficialArtifactIndexItem): Promise<OfficialCatalogItem> => {
    const theme = artifact.kind === 'theme' ? installedThemes.get(artifact.slug) : null;
    const plugin = artifact.kind === 'plugin' ? installedPlugins.get(artifact.slug) : null;
    const instance = plugin ? await PluginManagementService.getDefaultInstance(plugin.slug) : null;
    const readiness = plugin ? evaluatePluginConfigReadiness(plugin.manifestJson, {}) : null;
    return {
      slug: artifact.slug,
      name: theme?.name || plugin?.name || artifact.slug,
      kind: artifact.kind,
      target: artifact.kind === 'theme' ? 'shop' : undefined,
      version: artifact.version,
      author: theme?.author || plugin?.author || 'Jiffoo',
      description: theme?.description || plugin?.description || 'Verified official extension package.',
      category: artifact.kind === 'theme' ? 'storefront' : 'plugin',
      deliveryMode: 'package-managed',
      installState: theme ? 'active' : instance?.enabled ? 'enabled' : plugin ? 'installed' : 'not_installed',
      releaseStatus: 'published',
      source: toCatalogSource(theme?.source || plugin?.source),
      availableInMarket: true,
      installedVersion: theme?.version || plugin?.version || null,
      latestVersion: artifact.version,
      artifactPackageUrl: artifact.packageUrl,
      updateAvailable: Boolean((theme?.version || plugin?.version) && (theme?.version || plugin?.version) !== artifact.version),
      configRequired: readiness?.requiresConfiguration,
      configReady: readiness?.ready,
      missingConfigFields: readiness?.missingFields,
    };
  }));
  return { items, marketOnline: artifacts.length > 0, officialMarketOnly: isOfficialMarketOnly(), generatedAt: new Date().toISOString() };
}

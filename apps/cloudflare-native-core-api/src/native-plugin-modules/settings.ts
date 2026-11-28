import { NATIVE_PLUGIN_MODULES } from './registry';
import type { NativePluginModule } from './runtime';

/**
 * The settings composition point of native plugin modules. A module that has settings describes
 * its form here, and the core shows it in the Admin, saves it with the secrets encrypted, and
 * reads it back for the module the same way as for the plugins written into the core.
 */

/** One field of the form. `secret` fields are stored encrypted and are never read back in clear. */
export interface NativePluginSettingDescriptor {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'secret';
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  enum?: readonly string[];
  /** For `string` fields: the saved value must match. */
  pattern?: string;
  patternMessage?: string;
}

export interface NativePluginModuleSettings {
  /** What the Administrator knows the plugin by. */
  name: string;
  /** The plugin's version, shown next to the name. */
  version: string;
  description: string;
  /** The Admin group the plugin is listed under; `other` when left out. */
  category?: string;
  fields: readonly NativePluginSettingDescriptor[];
  /**
   * Refuses settings that are well-formed but wrong for the plugin. It is given the plain
   * (non-secret) values; it throws with the message the administrator should read.
   */
  validate?(config: Record<string, unknown>): void;
}

export type SettingsModule = NativePluginModule & { settings: NativePluginModuleSettings };

/** The settings form of the module under this slug, when the build compiled one in. */
export function nativeModuleSettings(id: unknown): NativePluginModuleSettings | null {
  if (typeof id !== 'string') return null;
  return NATIVE_PLUGIN_MODULES.find((module): module is SettingsModule => module.id === id && Boolean(module.settings))?.settings ?? null;
}

export function nativeModulesWithSettings(): SettingsModule[] {
  return NATIVE_PLUGIN_MODULES.filter((module): module is SettingsModule => Boolean(module.settings));
}

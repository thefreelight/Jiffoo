/**
 * The native plugin modules compiled into this worker, each under its plugin's slug.
 *
 * The open-source build compiles none: a module is a plugin's own implementation, and this
 * repository is the framework. A build that compiles modules in rewrites this file to list them
 * as static imports, so the bundler can see them. `runtime.ts` is the only code that reads this
 * list, and `/health` reports the ids. See docs/NATIVE-PLUGIN-MODULES.md.
 */
import type { NativePluginModule } from './runtime';

export const NATIVE_PLUGIN_MODULES: readonly NativePluginModule[] = [];

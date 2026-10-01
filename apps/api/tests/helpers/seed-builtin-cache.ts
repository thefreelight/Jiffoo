import path from 'node:path';
import { syncBuiltinPlugins } from '../../src/core/admin/extension-installer/builtin-sync';

export async function seedBuiltinCache(): Promise<void> {
  const targetRoot = process.env.EXTENSIONS_PATH;
  if (!targetRoot) return;
  await syncBuiltinPlugins(path.resolve('builtin-plugins'));
}

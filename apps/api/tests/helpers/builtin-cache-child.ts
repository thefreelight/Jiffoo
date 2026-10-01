import { syncBuiltinPlugins } from '@/core/admin/extension-installer/builtin-sync';
import { callContract } from '@/core/admin/extension-installer/plugin-runtime';
import { prisma } from '@/config/database';
import path from 'node:path';

async function main() {
  try {
    await syncBuiltinPlugins(path.join(process.cwd(), 'builtin-plugins'));
    const result = await callContract('free-shipping', 'shipping', 1, 'quote', {
      currency: 'USD', items: [], subtotalMinor: 0, address: { country: 'US' },
    });
    process.send?.({ kind: 'done', result });
  } catch (error) {
    process.send?.({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
  } finally {
    await prisma.$disconnect();
    process.disconnect?.();
  }
}

void main();

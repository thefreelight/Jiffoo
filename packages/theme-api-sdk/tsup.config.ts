import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: { resolve: ['shared', 'shared/types/theme', 'shared/types/dto'] },
  sourcemap: true,
  clean: true,
  external: ['jiffoo-core-api-sdk'],
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
  esbuildOptions(options) {
    options.sourcesContent = false;
  },
});

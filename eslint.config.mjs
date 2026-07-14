// ESLint 9 flat config (repo-hardening-2026h2 §2.1.2 follow-up).
//
// Scope: TypeScript sources across the workspace. The codebase was never
// lint-gated before, so the baseline is tuned like the coverage gate —
// correctness rules error, opinionated/stylistic rules stay warnings —
// and ratchets stricter over time.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.open-next/**',
      '**/.vercel/**',
      '**/coverage/**',
      '**/playwright-report*/**',
      '**/test-results/**',
      '**/*.d.ts',
      '**/generated/**',
      'packages/shop-themes/*/theme-pack/runtime/**',
      // Standalone npm packages with their own toolchains (installed and
      // tested independently of the workspace)
      'extensions/**',
      'artifacts/**',
      'deploy/**',
      '.codex-worktrees/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      // tsc already enforces these better (and allows intentional escapes)
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      // Noisy on a pre-existing codebase; keep visible but non-blocking
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      'prefer-const': 'warn',
      'no-var': 'warn',
      // Handled by TypeScript's own resolver
      'no-undef': 'off',
      'no-redeclare': 'off',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'no-case-declarations': 'warn',
      'no-control-regex': 'off',
      'no-prototype-builtins': 'warn',
      'no-async-promise-executor': 'warn',
    },
  },
);

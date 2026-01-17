/**
 * ESLint Configuration for Core API
 * 
 * Enforces architectural boundaries: Core API remains decoupled from Platform API.
 */

const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const parser = require('@typescript-eslint/parser');

module.exports = [
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: parser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
            },
        },
        plugins: {
            '@typescript-eslint': typescriptEslint,
        },
        rules: {
            // Architectural Integrity: Prevent tight coupling with Platform API
            'no-restricted-imports': ['error', {
                patterns: [
                    {
                        group: ['**/apps/platform-api/**'],
                        message: 'Core API cannot import from Platform API directly. Use defined communication protocols.',
                    },
                    {
                        group: ['**/platform-api/**'],
                        message: 'Core API cannot import from Platform API.',
                    },
                ],
            }],

            // TypeScript specific rules
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            }],
            '@typescript-eslint/no-explicit-any': 'off',
        },
    },
];

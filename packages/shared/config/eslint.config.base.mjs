import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * Base function for creating ESLint configuration
 * @param {Object} options - Configuration options
 * @param {Object} options.rules - Additional rules
 * @param {string[]} options.extends - Additional extends
 * @returns {Array} ESLint configuration array
 */
export function createESLintConfig(options = {}) {
  const {
    rules = {},
    extends: additionalExtends = [],
    ...otherOptions
  } = options;

  const baseExtends = ["next/core-web-vitals", "next/typescript"];
  const allExtends = [...baseExtends, ...additionalExtends];

  return [
    ...compat.extends(...allExtends),
    {
      rules: {
        // Base rules
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": "warn",
        "@typescript-eslint/no-empty-object-type": "off",
        "react/no-unescaped-entities": "off",
        "react-hooks/exhaustive-deps": "warn",

        // Merge user custom rules
        ...rules
      },
      ...otherOptions
    },
  ];
}

// Default configuration export
const eslintConfig = createESLintConfig();
export default eslintConfig;

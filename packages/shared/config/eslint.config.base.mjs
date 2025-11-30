import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * 创建ESLint配置的基础函数
 * @param {Object} options - 配置选项
 * @param {Object} options.rules - 额外的规则
 * @param {string[]} options.extends - 额外的扩展配置
 * @returns {Array} ESLint配置数组
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
        // 基础规则
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": "warn",
        "@typescript-eslint/no-empty-object-type": "off",
        "react/no-unescaped-entities": "off",
        "react-hooks/exhaustive-deps": "warn",
        
        // 合并用户自定义规则
        ...rules
      },
      ...otherOptions
    },
  ];
}

// 默认配置导出
const eslintConfig = createESLintConfig();
export default eslintConfig;

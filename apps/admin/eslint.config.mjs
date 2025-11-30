import { createESLintConfig } from "../../packages/shared/config/eslint.config.base.mjs";

const eslintConfig = createESLintConfig({
  // Super-Admin特定的规则可以在这里添加
});

export default eslintConfig;

# game-portal theme pack

PLAYGROUND 游戏大厅主题包（game.jiffoo.com）。发布物=三件套：
- theme.json
- tokens.css
- runtime/theme-runtime.js（`pnpm --filter @shop-themes/game-portal build:theme-runtime` 产出）

R2 物化遵循 docs/runbooks/bokmoo-theme-resource-release.md 双路径契约：
- extensions/themes/shop/game-portal/（canonical，含 data/ 与 games/ 静态游戏包）
- extensions/themes/shop/.versions/game-portal/<version>/（immutable 三件套）
任何 runtime/manifest 内容修复必须 bump version（版本化路径缓存一年）。

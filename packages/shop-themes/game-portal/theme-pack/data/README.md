# data/ 目录说明

games.json / games-gm.json 由独立仓库 `/Users/jordan/Projects/game-portal` 的
`data/` 同步而来（同步脚本会把相对 path/thumb 改写为本主题资产绝对路径）。
部署到 R2 的 canonical 路径：`extensions/themes/shop/game-portal/data/`，
缓存 max-age=300 —— 目录更新不需要 bump 主题版本。

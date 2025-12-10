#!/bin/bash

# 同时推送到 GitHub 和 GitLab
# 用法: ./scripts/push-to-all.sh [branch]

set -e

BRANCH=${1:-main}

echo "🚀 同时推送到 GitHub 和 GitLab..."
echo ""

echo "📋 检查远程仓库配置："
git remote -v | grep -E "(github|gitlab|all)" || true

echo ""
echo "📝 当前分支: $(git branch --show-current)"
echo "📤 目标分支: $BRANCH"

echo ""
echo "📊 Git 状态："
git status --short

echo ""
echo "📤 推送到所有远程仓库..."

# 推送到 all 远程（同时推送到 GitHub 和 GitLab）
if git remote | grep -q "^all$"; then
    echo "  ✓ 使用 'all' 远程推送..."
    git push all "$BRANCH"
else
    echo "  ✓ 分别推送到 GitHub 和 GitLab..."
    git push origin "$BRANCH" || echo "⚠️  GitHub 推送失败"
    git push gitlab "$BRANCH" || echo "⚠️  GitLab 推送失败"
fi

echo ""
echo "✅ 推送完成！"
echo ""
echo "🔗 查看 Pipeline："
echo "  - GitLab: https://git.lafdru.local/lafdru/jiffoo-mall-core/-/pipelines"
echo "  - GitHub: https://github.com/thefreelight/jiffoo-mall-core/actions"


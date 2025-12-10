#!/bin/bash
# 同时推送到 GitLab 和 GitHub 的脚本
# 用法: ./scripts/git-push-all.sh [commit message]
# 或者: git push-all (如果设置了 git alias)

set -e

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 同步推送到 GitLab 和 GitHub${NC}"
echo ""

# 检查是否有未提交的更改
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}📝 检测到未提交的更改${NC}"
    
    if [ -n "$1" ]; then
        COMMIT_MSG="$*"
    else
        echo -e "${YELLOW}请输入提交信息:${NC}"
        read -r COMMIT_MSG
    fi
    
    if [ -z "$COMMIT_MSG" ]; then
        echo -e "${RED}❌ 提交信息不能为空${NC}"
        exit 1
    fi
    
    git add -A
    git commit -m "$COMMIT_MSG"
    echo -e "${GREEN}✅ 已提交: $COMMIT_MSG${NC}"
else
    echo -e "${GREEN}✅ 没有新的更改需要提交${NC}"
fi

# 获取当前分支
BRANCH=$(git branch --show-current)
echo -e "${BLUE}📌 当前分支: $BRANCH${NC}"

# 推送到 GitLab (origin)
echo ""
echo -e "${BLUE}📤 推送到 GitLab...${NC}"
if git push origin "$BRANCH"; then
    echo -e "${GREEN}✅ GitLab 推送成功${NC}"
else
    echo -e "${RED}❌ GitLab 推送失败${NC}"
    exit 1
fi

# 检查 GitHub remote 是否存在
if ! git remote | grep -q "^github$"; then
    echo -e "${RED}❌ GitHub remote 不存在${NC}"
    echo -e "${YELLOW}请先运行以下命令添加 GitHub remote:${NC}"
    echo "   git remote add github https://YOUR_GITHUB_TOKEN@github.com/thefreelight/jiffoo-mall-core.git"
    exit 1
fi

# 推送到 GitHub (使用 force，因为 GitHub 是过滤后的镜像)
echo ""
echo -e "${BLUE}📤 推送到 GitHub (force)...${NC}"
echo -e "${YELLOW}⚠️  注意: GitHub 是过滤敏感文件后的镜像，使用 force push${NC}"
if git push github "$BRANCH" --force; then
    echo -e "${GREEN}✅ GitHub 推送成功${NC}"
else
    echo -e "${RED}❌ GitHub 推送失败${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 同步完成！${NC}"


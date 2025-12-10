#!/bin/bash

# Jiffoo Mall - Open Source Sync Script
# 将私有仓库同步到开源仓库，排除敏感内容

set -e

# 配置
SOURCE_REPO="${SOURCE_REPO:-/Users/jordan/Projects/jiffoo-mall-core}"
TARGET_REPO="${TARGET_REPO:-/Users/jordan/Projects/Jiffoo}"
EXCLUDE_FILE="${SOURCE_REPO}/.opensourceexclude"
DRY_RUN="${DRY_RUN:-false}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查参数
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN="true"
    log_info "Running in DRY-RUN mode (no changes will be made)"
fi

# 验证源仓库存在
if [[ ! -d "$SOURCE_REPO" ]]; then
    log_error "Source repository not found: $SOURCE_REPO"
    exit 1
fi

# 验证目标仓库存在
if [[ ! -d "$TARGET_REPO" ]]; then
    log_error "Target repository not found: $TARGET_REPO"
    exit 1
fi

# 验证排除文件存在
if [[ ! -f "$EXCLUDE_FILE" ]]; then
    log_warning "Exclude file not found: $EXCLUDE_FILE"
    log_warning "Using default exclusions only"
fi

log_info "Starting sync from $SOURCE_REPO to $TARGET_REPO"

# 构建 rsync 排除参数
RSYNC_EXCLUDES=(
    # 基础排除
    "--exclude=.git"
    "--exclude=node_modules"
    "--exclude=.next"
    "--exclude=dist"
    "--exclude=build"
    "--exclude=.pnpm-store"
    "--exclude=*.tsbuildinfo"
    
    # 平台管理后台（不开源）
    "--exclude=apps/super-admin"
    "--exclude=e2e/super-admin"
    "--exclude=apps/api/src/core/super-admin"
    
    # 敏感配置
    "--exclude=.env*"
    "--exclude=*.env"
    "--exclude=kubeconfig"
    "--exclude=*.pem"
    "--exclude=*.key"
    "--exclude=*.crt"
    
    # 商业目录
    "--exclude=commercial"
    
    # 内部配置
    "--exclude=.kiro"
    "--exclude=.claude"
    "--exclude=.vscode"
    "--exclude=.idea"
    
    # 备份和临时文件
    "--exclude=backup"
    "--exclude=backups"
    "--exclude=*.backup"
    "--exclude=*.bak"
    "--exclude=*.old"
    "--exclude=.DS_Store"
    
    # 测试产物
    "--exclude=playwright-report"
    "--exclude=test-results"
    "--exclude=coverage"
    
    # 日志和上传
    "--exclude=logs"
    "--exclude=uploads"
    
    # E2E 配置（包含敏感测试账号）
    "--exclude=e2e/utils/staging-test-accounts.ts"
    "--exclude=e2e/staging-setup.ts"
    "--exclude=playwright.staging.config.ts"
    "--exclude=scripts/seed-staging-accounts.ts"
)

# 从 .opensourceexclude 读取额外排除
if [[ -f "$EXCLUDE_FILE" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
        # 跳过空行和注释
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        # 清理空格
        line=$(echo "$line" | xargs)
        [[ -n "$line" ]] && RSYNC_EXCLUDES+=("--exclude=$line")
    done < "$EXCLUDE_FILE"
fi

# 构建 rsync 命令
RSYNC_CMD="rsync -av --delete"
for exclude in "${RSYNC_EXCLUDES[@]}"; do
    RSYNC_CMD+=" $exclude"
done
RSYNC_CMD+=" $SOURCE_REPO/ $TARGET_REPO/"

if [[ "$DRY_RUN" == "true" ]]; then
    RSYNC_CMD+=" --dry-run"
fi

log_info "Executing rsync..."
eval "$RSYNC_CMD"

# 如果不是 dry-run，执行后续操作
if [[ "$DRY_RUN" != "true" ]]; then
    cd "$TARGET_REPO"
    
    # 检查是否有变更
    if git diff --quiet && git diff --cached --quiet; then
        log_info "No changes to sync"
    else
        log_success "Sync completed! Changes detected."
        git status --short
        
        echo ""
        log_info "To commit and push the changes:"
        echo "  cd $TARGET_REPO"
        echo "  git add -A"
        echo "  git commit -m 'sync: update from private repository'"
        echo "  git push origin main"
    fi
else
    log_success "Dry-run completed! Review the output above."
fi


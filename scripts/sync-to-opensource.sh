#!/bin/bash

# 同步核心版本到开源版本
# 从 jiffoo-mall-core 同步到 jiffoo-mall

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo "🔄 同步核心版本到开源版本..."

# 检查是否在核心仓库目录
if [ ! -f ".opensourceexclude" ]; then
    echo "❌ 请在 jiffoo-mall-core 目录运行此脚本"
    exit 1
fi

# 检查开源仓库是否存在
OPENSOURCE_DIR="../Jiffoo"
if [ ! -d "$OPENSOURCE_DIR" ]; then
    print_warning "开源仓库目录不存在: $OPENSOURCE_DIR"
    echo "请确保开源仓库在正确位置，或修改脚本中的路径"
    exit 1
fi

print_info "开始同步文件..."

# 同步文件，排除商业功能
rsync -av --exclude-from=.opensourceexclude \
    --exclude='.git/' \
    --exclude='node_modules/' \
    --exclude='dist/' \
    ./ "$OPENSOURCE_DIR/"

print_status "文件同步完成"

# 进入开源仓库目录
cd "$OPENSOURCE_DIR"

print_info "处理开源版本特定修改..."

# 替换商业功能标记为演示版本
find . -name "*.ts" -type f -exec sed -i.bak 's/COMMERCIAL_FEATURE=true/COMMERCIAL_FEATURE=false/g' {} \;
find . -name "*.tsx" -type f -exec sed -i.bak 's/COMMERCIAL_FEATURE=true/COMMERCIAL_FEATURE=false/g' {} \;
find . -name "*.js" -type f -exec sed -i.bak 's/COMMERCIAL_FEATURE=true/COMMERCIAL_FEATURE=false/g' {} \;

# 清理可能遗漏的商业功能目录
print_info "清理可能遗漏的商业功能..."
rm -rf commercial-repo-setup jiffoo-mall-commercial develop_doc logs src 2>/dev/null || true
rm -rf apps/backend/src/core/saas apps/backend/src/core/saas-marketplace 2>/dev/null || true
rm -rf apps/backend/src/core/licensing apps/backend/src/core/plugin-store 2>/dev/null || true
rm -rf apps/backend/src/core/templates apps/backend/src/core/tenant 2>/dev/null || true
rm -rf apps/backend/src/core/sales apps/backend/src/plugins/premium 2>/dev/null || true
rm -rf apps/backend/src/plugins/core 2>/dev/null || true
rm -rf apps/admin/app/business-model apps/admin/app/finance 2>/dev/null || true
rm -rf apps/admin/app/licenses apps/admin/app/marketplace 2>/dev/null || true
rm -rf apps/admin/app/plugin-store apps/admin/app/plugins/licenses 2>/dev/null || true
rm -rf apps/admin/app/api/commercial apps/admin/app/test-config 2>/dev/null || true
rm -rf apps/frontend/src/app/plugin-store 2>/dev/null || true
rm -f apps/backend/src/routes/license-routes.ts 2>/dev/null || true
rm -f apps/backend/src/plugins/premium-analytics-plugin.ts 2>/dev/null || true
rm -f apps/backend/src/plugins/license-service.ts 2>/dev/null || true
rm -f apps/backend/src/plugins/monetization-examples.ts 2>/dev/null || true
rm -f apps/backend/src/plugins/api-control.ts 2>/dev/null || true
rm -f apps/backend/src/plugins/ecosystem-control.ts 2>/dev/null || true

# 清理商业相关文档
rm -f AI_FIRST_STRATEGY.md BUSINESS_MODEL.md BUSINESS_STRATEGY.md 2>/dev/null || true
rm -f COMMERCIALIZATION_*.md COMMERCIAL_*.md HYBRID_BUSINESS_*.md 2>/dev/null || true
rm -f MULTI_TENANT_OEM_*.md LICENSE-COMMERCIAL.md 2>/dev/null || true
rm -f DEPLOYMENT_ARCHITECTURE_ANALYSIS.md DUAL_ENVIRONMENT_*.md 2>/dev/null || true
rm -f FEATURES_COMPLETED.md FEATURE_COMPLETION_SUMMARY.md 2>/dev/null || true
rm -f PLUGIN_DEVELOPMENT_GUIDE.md PROJECT_FINAL_SUMMARY.md 2>/dev/null || true
rm -f REPOSITORY_ARCHITECTURE.md setup-commercial-repo.sh 2>/dev/null || true
rm -f setup-dual-environment.sh test-*.sh test-*.js 2>/dev/null || true

# 清理备份文件
find . -name "*.bak" -delete

# 更新 package.json 为开源版本
if [ -f "package.json" ]; then
    sed -i.bak 's/"name": "jiffoo-mall-core"/"name": "jiffoo"/' package.json
    sed -i.bak 's/"description": ".*"/"description": "A comprehensive, full-stack e-commerce platform built with modern technologies"/' package.json
    rm package.json.bak 2>/dev/null || true
fi

# 清理 server.ts 中的商业路由引用
if [ -f "apps/backend/src/server.ts" ]; then
    print_info "清理 server.ts 中的商业功能引用..."
    # 移除商业路由的导入
    sed -i.bak '/import.*licensing/d' apps/backend/src/server.ts
    sed -i.bak '/import.*plugin-store/d' apps/backend/src/server.ts
    sed -i.bak '/import.*saas/d' apps/backend/src/server.ts
    sed -i.bak '/import.*template/d' apps/backend/src/server.ts
    sed -i.bak '/import.*tenant/d' apps/backend/src/server.ts
    sed -i.bak '/import.*sales/d' apps/backend/src/server.ts
    sed -i.bak '/import.*saas-marketplace/d' apps/backend/src/server.ts

    # 移除商业路由的注册
    sed -i.bak '/licenseRoutes/d' apps/backend/src/server.ts
    sed -i.bak '/pluginStoreRoutes/d' apps/backend/src/server.ts
    sed -i.bak '/saasRoutes/d' apps/backend/src/server.ts
    sed -i.bak '/templateRoutes/d' apps/backend/src/server.ts
    sed -i.bak '/tenantRoutes/d' apps/backend/src/server.ts
    sed -i.bak '/salesRoutes/d' apps/backend/src/server.ts
    sed -i.bak '/saasMarketplaceRoutes/d' apps/backend/src/server.ts

    rm apps/backend/src/server.ts.bak 2>/dev/null || true
fi

# 更新 README 为开源版本
if [ -f "README.md" ] && grep -q "Private Development Repository" README.md; then
    # 移除私有仓库说明，恢复开源版本的 README
    sed -i.bak '/^# Jiffoo Mall Core 🔒/,/^---$/d' README.md
    rm README.md.bak 2>/dev/null || true
fi

print_status "开源版本处理完成"

print_info "检查更改..."
if git diff --quiet; then
    print_info "没有新的更改需要提交"
else
    print_info "发现更改，准备提交..."
    git add .
    git commit -m "Sync from core repository

- Updated from jiffoo-mall-core
- Removed commercial features
- Updated for open-source distribution
- $(date '+%Y-%m-%d %H:%M:%S')"
    
    print_warning "更改已提交到本地，请手动推送到远程仓库:"
    echo "cd $OPENSOURCE_DIR && git push"
fi

print_status "同步完成！"
echo ""
echo "📋 同步结果:"
echo "   🔒 源: jiffoo-mall-core (完整版本)"
echo "   🌍 目标: jiffoo-mall (开源版本)"
echo "   📝 状态: 已同步并处理为开源版本"

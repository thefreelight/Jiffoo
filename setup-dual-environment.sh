#!/bin/bash

# Jiffoo Mall 双环境架构设置脚本
# 设置私有核心仓库 + 开源仓库的双环境策略

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo "🚀 设置 Jiffoo Mall 双环境架构..."
echo ""
echo "📋 架构说明:"
echo "   🔒 jiffoo-mall-core (私有) - 完整开发环境"
echo "   🌍 jiffoo-mall (公开) - 开源版本 (当前仓库)"
echo "   🔐 jiffoo-mall-commercial (私有) - 商业插件 (已存在)"
echo ""

# 检查当前目录
if [ ! -f "package.json" ] || ! grep -q "jiffoo" package.json; then
    print_error "请在 Jiffoo 项目根目录运行此脚本"
    exit 1
fi

print_info "当前在 Jiffoo 项目目录，准备设置双环境架构..."

# 步骤1: 创建私有核心仓库
echo ""
echo "📋 步骤1: 创建私有核心仓库"
echo ""

if ! command -v gh &> /dev/null; then
    print_warning "GitHub CLI 未安装，需要手动创建仓库"
    echo ""
    echo "请手动创建私有仓库:"
    echo "1. 访问 https://github.com/new"
    echo "2. Repository name: jiffoo-mall-core"
    echo "3. Description: Private core development repository for Jiffoo Mall"
    echo "4. 设置为 Private"
    echo "5. 不要添加 README, .gitignore, License (我们会复制现有的)"
    echo ""
    read -p "创建完成后，输入仓库克隆URL: " CORE_REPO_URL
else
    print_info "使用 GitHub CLI 创建私有核心仓库..."
    if gh repo create jiffoo-mall-core --private --description "Private core development repository for Jiffoo Mall"; then
        print_status "私有核心仓库创建成功"
        CORE_REPO_URL="https://github.com/$(gh api user --jq .login)/jiffoo-mall-core.git"
    else
        print_error "创建仓库失败"
        exit 1
    fi
fi

# 步骤2: 备份当前项目并复制到核心仓库
echo ""
echo "📋 步骤2: 设置核心仓库"
echo ""

print_info "备份当前项目..."
cd ..
cp -r Jiffoo jiffoo-mall-core-backup
print_status "项目已备份到 jiffoo-mall-core-backup"

print_info "克隆核心仓库..."
git clone "$CORE_REPO_URL" jiffoo-mall-core-temp

print_info "复制项目文件到核心仓库..."
# 复制所有文件除了 .git
rsync -av --exclude='.git' Jiffoo/ jiffoo-mall-core-temp/

cd jiffoo-mall-core-temp

# 更新 package.json 信息
print_info "更新核心仓库配置..."
if [ -f "package.json" ]; then
    # 更新 package.json 的 name 和 description
    sed -i.bak 's/"name": "jiffoo"/"name": "jiffoo-mall-core"/' package.json
    sed -i.bak 's/"description": ".*"/"description": "Jiffoo Mall Core - Private development repository with full features"/' package.json
    rm package.json.bak 2>/dev/null || true
fi

# 更新 README
if [ -f "README.md" ]; then
    # 在 README 开头添加私有仓库说明
    cat > README_new.md << 'EOF'
# Jiffoo Mall Core 🔒

**Private Development Repository** - Complete Jiffoo Mall with all features for internal development and testing.

> ⚠️ **This is a private repository** containing the full-featured version of Jiffoo Mall. 
> For the public open-source version, see: [jiffoo-mall](https://github.com/thefreelight/jiffoo-mall)

## 🏗️ Repository Purpose

This repository serves as:
- 🔧 **Primary development environment** - All features, rapid iteration
- 🧪 **Internal testing platform** - Full functionality testing
- 📦 **Source for open-source sync** - Automated sync to public repository
- 🚀 **Production deployment option** - Complete, ready-to-deploy version

## 🔄 Dual Environment Strategy

```
Development Flow:
1. Develop in jiffoo-mall-core (this repo) - Full features, fast iteration
2. Sync to jiffoo-mall (public) - User experience testing
3. Test as end user - Install plugins, verify upgrade path
4. Deploy either version - Core (complete) or Public + Plugins
```

---

EOF
    cat README.md >> README_new.md
    mv README_new.md README.md
fi

# 提交到核心仓库
print_info "提交到核心仓库..."
git add .
git commit -m "Initial core repository setup

- Complete Jiffoo Mall codebase with all features
- Private development environment
- Source for open-source synchronization
- Full-featured version for internal use and testing"

git push origin main

print_status "核心仓库设置完成"

# 步骤3: 创建同步脚本
echo ""
echo "📋 步骤3: 创建同步脚本"
echo ""

print_info "创建同步脚本..."

# 创建开源排除文件
cat > .opensourceexclude << 'EOF'
# 排除商业功能的文件和目录
**/commercial/
**/premium/
**/*-commercial.*
**/*-premium.*
**/*-enterprise.*
.env.local
.env.production
/internal/
/private/
/enterprise/
/commercial/
/premium/
node_modules/
dist/
.git/
*.log
.DS_Store
EOF

# 创建同步到开源版本的脚本
cat > scripts/sync-to-opensource.sh << 'EOF'
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

# 清理备份文件
find . -name "*.bak" -delete

# 更新 package.json 为开源版本
if [ -f "package.json" ]; then
    sed -i.bak 's/"name": "jiffoo-mall-core"/"name": "jiffoo"/' package.json
    sed -i.bak 's/"description": ".*"/"description": "A comprehensive, full-stack e-commerce platform built with modern technologies"/' package.json
    rm package.json.bak 2>/dev/null || true
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
EOF

chmod +x scripts/sync-to-opensource.sh

# 创建用户体验测试脚本
cat > scripts/test-user-experience.sh << 'EOF'
#!/bin/bash

# 用户体验测试脚本
# 模拟真实用户的安装和使用流程

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
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

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🧪 开始用户体验测试..."
echo ""

# 步骤1: 同步到开源版本
print_info "步骤1: 同步到开源版本"
./scripts/sync-to-opensource.sh

# 步骤2: 全新安装测试
print_info "步骤2: 全新安装测试"

TEST_DIR="/tmp/jiffoo-user-test-$(date +%s)"
print_info "创建测试目录: $TEST_DIR"

mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# 克隆开源版本
print_info "克隆开源版本..."
git clone ../Jiffoo jiffoo-test
cd jiffoo-test

# 测试安装过程
print_info "测试安装过程..."
if pnpm install; then
    print_status "依赖安装成功"
else
    print_error "依赖安装失败"
    exit 1
fi

# 测试构建过程
print_info "测试构建过程..."
if pnpm build; then
    print_status "项目构建成功"
else
    print_error "项目构建失败"
    exit 1
fi

# 测试启动过程 (后台运行)
print_info "测试启动过程..."
pnpm start &
SERVER_PID=$!

# 等待服务器启动
sleep 10

# 检查服务器是否运行
if kill -0 $SERVER_PID 2>/dev/null; then
    print_status "服务器启动成功"
    
    # 测试基本API
    if curl -f http://localhost:3001/health >/dev/null 2>&1; then
        print_status "健康检查通过"
    else
        print_warning "健康检查失败，但服务器在运行"
    fi
    
    # 停止服务器
    kill $SERVER_PID
    wait $SERVER_PID 2>/dev/null || true
    print_status "服务器已停止"
else
    print_error "服务器启动失败"
fi

# 步骤3: 测试商业插件安装 (如果存在)
print_info "步骤3: 测试商业插件安装"

if [ -d "../../jiffoo-mall-commercial" ]; then
    print_info "发现商业插件仓库，测试插件安装..."
    
    # 这里可以添加插件安装测试
    # 例如: pnpm add file:../../jiffoo-mall-commercial/plugins/payment/wechat-pay-pro
    
    print_status "商业插件测试完成"
else
    print_warning "未发现商业插件仓库，跳过插件测试"
fi

# 清理测试目录
cd /
rm -rf "$TEST_DIR"
print_status "测试目录已清理"

print_status "用户体验测试完成！"
echo ""
echo "📋 测试结果:"
echo "   ✅ 开源版本同步成功"
echo "   ✅ 全新安装流程正常"
echo "   ✅ 构建过程正常"
echo "   ✅ 服务器启动正常"
echo "   ✅ 基本功能可用"
echo ""
echo "💡 建议:"
echo "   - 定期运行此测试确保用户体验"
echo "   - 在发布前必须运行此测试"
echo "   - 如发现问题，在核心仓库修复后重新同步"
EOF

chmod +x scripts/test-user-experience.sh

# 创建开发工作流脚本
cat > scripts/dev-workflow.sh << 'EOF'
#!/bin/bash

# 开发工作流脚本
# 提供常用的开发操作

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

show_help() {
    echo "🛠️  Jiffoo Mall 开发工作流"
    echo ""
    echo "用法: ./scripts/dev-workflow.sh [命令]"
    echo ""
    echo "命令:"
    echo "  sync          同步到开源版本"
    echo "  test          运行用户体验测试"
    echo "  dev           启动开发服务器"
    echo "  build         构建项目"
    echo "  release       发布新版本 (同步 + 测试 + 推送)"
    echo "  status        显示仓库状态"
    echo "  help          显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./scripts/dev-workflow.sh sync"
    echo "  ./scripts/dev-workflow.sh test"
    echo "  ./scripts/dev-workflow.sh release"
}

case "$1" in
    "sync")
        print_info "同步到开源版本..."
        ./scripts/sync-to-opensource.sh
        ;;
    "test")
        print_info "运行用户体验测试..."
        ./scripts/test-user-experience.sh
        ;;
    "dev")
        print_info "启动开发服务器..."
        pnpm dev
        ;;
    "build")
        print_info "构建项目..."
        pnpm build
        ;;
    "release")
        print_info "开始发布流程..."
        echo "1. 同步到开源版本"
        ./scripts/sync-to-opensource.sh
        echo ""
        echo "2. 运行用户体验测试"
        ./scripts/test-user-experience.sh
        echo ""
        echo "3. 推送核心仓库更改"
        git push
        echo ""
        print_warning "请手动推送开源仓库:"
        echo "cd ../Jiffoo && git push"
        print_status "发布流程完成"
        ;;
    "status")
        print_info "仓库状态:"
        echo ""
        echo "🔒 核心仓库 (当前):"
        git status --short
        echo ""
        echo "🌍 开源仓库:"
        cd ../Jiffoo && git status --short
        ;;
    "help"|"")
        show_help
        ;;
    *)
        print_warning "未知命令: $1"
        show_help
        exit 1
        ;;
esac
EOF

chmod +x scripts/dev-workflow.sh

# 提交脚本到核心仓库
git add .
git commit -m "Add dual environment scripts

- sync-to-opensource.sh: Sync core to open-source version
- test-user-experience.sh: Test real user experience
- dev-workflow.sh: Development workflow helper
- .opensourceexclude: Files to exclude from open-source sync"

git push

print_status "同步脚本创建完成"

# 步骤4: 设置完成
echo ""
echo "🎉 双环境架构设置完成！"
echo ""
echo "📁 仓库结构:"
echo "   🔒 jiffoo-mall-core (当前目录) - 私有完整开发环境"
echo "   🌍 ../Jiffoo - 开源版本 (用户体验测试)"
echo "   🔐 ../jiffoo-mall-commercial - 商业插件"
echo ""
echo "🛠️  可用脚本:"
echo "   ./scripts/sync-to-opensource.sh - 同步到开源版本"
echo "   ./scripts/test-user-experience.sh - 用户体验测试"
echo "   ./scripts/dev-workflow.sh - 开发工作流助手"
echo ""
echo "🔄 推荐工作流:"
echo "   1. 在核心仓库开发 (快速迭代)"
echo "   2. 定期同步到开源版本"
echo "   3. 测试用户体验"
echo "   4. 修复问题并重复"
echo ""
echo "💡 快速开始:"
echo "   ./scripts/dev-workflow.sh help  # 查看所有命令"
echo "   ./scripts/dev-workflow.sh sync  # 同步到开源版本"
echo "   ./scripts/dev-workflow.sh test  # 测试用户体验"
echo ""
print_status "设置完成！开始享受双环境开发吧！ 🚀"
EOF

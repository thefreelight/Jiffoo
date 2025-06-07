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

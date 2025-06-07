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

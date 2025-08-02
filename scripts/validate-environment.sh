#!/bin/bash

# 开发环境验证工具
# 检查所有必要的依赖文件和配置，确保项目能正常启动

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}==================== $1 ====================${NC}"
}

# 检查结果函数
check_result() {
    if [ $1 -eq 0 ]; then
        print_success "$2"
    else
        print_error "$2"
        VALIDATION_FAILED=true
    fi
}

# 初始化
VALIDATION_FAILED=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

print_header "开发环境验证工具"
print_info "项目根目录: $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# ==================== 基础环境检查 ====================
print_header "基础环境检查"

# 检查 Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js 已安装: $NODE_VERSION"
else
    print_error "Node.js 未安装"
    VALIDATION_FAILED=true
fi

# 检查 pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm --version)
    print_success "pnpm 已安装: v$PNPM_VERSION"
else
    print_error "pnpm 未安装"
    VALIDATION_FAILED=true
fi

# 检查 Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_success "Docker 已安装: $DOCKER_VERSION"
else
    print_warning "Docker 未安装（可选，用于数据库）"
fi

# ==================== 项目结构检查 ====================
print_header "项目结构检查"

# 检查关键文件
CRITICAL_FILES=(
    "package.json"
    "pnpm-workspace.yaml"
    "apps/backend/package.json"
    "apps/backend/src/server.ts"
    "apps/backend/prisma/schema.prisma"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "关键文件存在: $file"
    else
        print_error "关键文件缺失: $file"
        VALIDATION_FAILED=true
    fi
done

# ==================== 商业功能 Stub 文件检查 ====================
print_header "商业功能 Stub 文件检查"

# 检查 stub 文件
STUB_FILES=(
    "apps/backend/src/core/licensing-stub/license-routes.ts"
    "apps/backend/src/core/plugin-store-stub/plugin-store-routes.ts"
    "apps/backend/src/core/saas-stub/saas-routes.ts"
    "apps/backend/src/core/templates-stub/template-manager.ts"
    "apps/backend/src/core/tenant-stub/tenant-routes.ts"
    "apps/backend/src/core/sales-stub/sales-routes.ts"
    "apps/backend/src/core/auth-stub/oauth2-routes.ts"
    "apps/backend/src/core/saas-marketplace-stub/saas-routes.ts"
    "apps/backend/src/routes-stub/license-routes.ts"
)

for file in "${STUB_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "Stub 文件存在: $file"
    else
        print_error "Stub 文件缺失: $file"
        VALIDATION_FAILED=true
    fi
done

# ==================== TypeScript 编译检查 ====================
print_header "TypeScript 编译检查"

print_info "检查 TypeScript 编译..."
cd apps/backend

if pnpm tsc --noEmit > /dev/null 2>&1; then
    print_success "TypeScript 编译检查通过"
else
    print_error "TypeScript 编译检查失败"
    print_info "运行详细检查..."
    pnpm tsc --noEmit
    VALIDATION_FAILED=true
fi

cd "$PROJECT_ROOT"

# ==================== 依赖检查 ====================
print_header "依赖检查"

print_info "检查依赖安装状态..."
if [ -d "node_modules" ]; then
    print_success "根目录依赖已安装"
else
    print_warning "根目录依赖未安装，运行: pnpm install"
fi

if [ -d "apps/backend/node_modules" ]; then
    print_success "Backend 依赖已安装"
else
    print_warning "Backend 依赖未安装，运行: pnpm install"
fi

# ==================== 环境变量检查 ====================
print_header "环境变量检查"

ENV_FILE="apps/backend/.env"
if [ -f "$ENV_FILE" ]; then
    print_success "环境变量文件存在: $ENV_FILE"
    
    # 检查关键环境变量
    if grep -q "DATABASE_URL" "$ENV_FILE"; then
        print_success "DATABASE_URL 已配置"
    else
        print_warning "DATABASE_URL 未配置"
    fi
    
    if grep -q "JWT_SECRET" "$ENV_FILE"; then
        print_success "JWT_SECRET 已配置"
    else
        print_warning "JWT_SECRET 未配置"
    fi
else
    print_warning "环境变量文件不存在: $ENV_FILE"
    print_info "请复制 .env.example 到 .env 并配置相关变量"
fi

# ==================== 端口检查 ====================
print_header "端口检查"

DEFAULT_PORT=3001
if lsof -ti:$DEFAULT_PORT > /dev/null 2>&1; then
    PID=$(lsof -ti:$DEFAULT_PORT)
    print_warning "端口 $DEFAULT_PORT 被占用 (PID: $PID)"
    print_info "如需释放端口，运行: kill $PID"
else
    print_success "端口 $DEFAULT_PORT 可用"
fi

# ==================== 数据库检查 ====================
print_header "数据库检查"

if [ -f "$ENV_FILE" ]; then
    DATABASE_URL=$(grep "DATABASE_URL" "$ENV_FILE" | cut -d '=' -f2- | tr -d '"')
    if [[ $DATABASE_URL == *"postgresql"* ]]; then
        print_info "检测到 PostgreSQL 数据库配置"
        print_info "确保 PostgreSQL 服务正在运行"
    elif [[ $DATABASE_URL == *"sqlite"* ]]; then
        print_info "检测到 SQLite 数据库配置"
        print_success "SQLite 无需额外服务"
    else
        print_warning "未识别的数据库类型"
    fi
fi

# ==================== 总结 ====================
print_header "验证总结"

if [ "$VALIDATION_FAILED" = true ]; then
    print_error "环境验证失败！请修复上述问题后重试。"
    echo ""
    print_info "常见解决方案："
    print_info "1. 安装依赖: pnpm install"
    print_info "2. 配置环境变量: cp apps/backend/.env.example apps/backend/.env"
    print_info "3. 生成 Prisma 客户端: cd apps/backend && pnpm prisma generate"
    print_info "4. 运行数据库迁移: cd apps/backend && pnpm prisma migrate dev"
    echo ""
    exit 1
else
    print_success "环境验证通过！项目可以正常启动。"
    echo ""
    print_info "启动项目:"
    print_info "cd apps/backend && pnpm dev"
    echo ""
    exit 0
fi

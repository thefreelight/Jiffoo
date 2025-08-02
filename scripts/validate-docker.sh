#!/bin/bash

# Docker Compose 验证工具
# 验证 Docker 环境和容器化部署

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

# 项目路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 显示帮助信息
show_help() {
    echo "Docker Compose 验证工具"
    echo ""
    echo "用法:"
    echo "  $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help              显示帮助信息"
    echo "  -c, --check             检查 Docker 环境"
    echo "  -b, --build             构建所有镜像"
    echo "  -u, --up               启动所有服务"
    echo "  -d, --down             停止所有服务"
    echo "  -l, --logs             查看服务日志"
    echo "  -s, --status           查看服务状态"
    echo "  -t, --test             测试服务连接"
    echo "  --clean                清理所有容器和镜像"
    echo "  --reset                重置整个环境"
    echo ""
    echo "示例:"
    echo "  $0 --check             # 检查 Docker 环境"
    echo "  $0 --build             # 构建镜像"
    echo "  $0 --up                # 启动服务"
    echo "  $0 --test              # 测试服务"
}

# 检查 Docker 环境
check_docker_environment() {
    print_header "Docker 环境检查"
    
    # 检查 Docker 是否安装
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装"
        return 1
    fi
    
    DOCKER_VERSION=$(docker --version)
    print_success "Docker 已安装: $DOCKER_VERSION"
    
    # 检查 Docker 是否运行
    if ! docker ps &> /dev/null; then
        print_error "Docker 服务未运行"
        return 1
    fi
    
    print_success "Docker 服务正在运行"
    
    # 检查 Docker Compose 是否安装
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose 未安装"
        return 1
    fi
    
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version)
        print_success "Docker Compose 已安装: $COMPOSE_VERSION"
    else
        COMPOSE_VERSION=$(docker compose version)
        print_success "Docker Compose (plugin) 已安装: $COMPOSE_VERSION"
    fi
    
    # 检查 Docker Compose 文件
    cd "$PROJECT_ROOT"
    
    if [ ! -f "docker-compose.yml" ]; then
        print_error "docker-compose.yml 文件不存在"
        return 1
    fi
    
    print_success "docker-compose.yml 文件存在"
    
    # 验证 Docker Compose 文件语法
    if docker-compose config &> /dev/null || docker compose config &> /dev/null; then
        print_success "docker-compose.yml 语法正确"
    else
        print_error "docker-compose.yml 语法错误"
        return 1
    fi
    
    # 检查 Dockerfile 文件
    DOCKERFILES=(
        "apps/backend/Dockerfile"
        "apps/frontend/Dockerfile"
        "apps/admin/Dockerfile"
    )
    
    for dockerfile in "${DOCKERFILES[@]}"; do
        if [ -f "$dockerfile" ]; then
            print_success "Dockerfile 存在: $dockerfile"
        else
            print_warning "Dockerfile 不存在: $dockerfile"
        fi
    done
    
    # 检查初始化脚本
    if [ -f "scripts/init-db.sql" ]; then
        print_success "数据库初始化脚本存在"
    else
        print_warning "数据库初始化脚本不存在"
    fi
}

# 构建镜像
build_images() {
    print_header "构建 Docker 镜像"
    
    cd "$PROJECT_ROOT"
    
    print_info "构建所有镜像..."
    if docker-compose build --no-cache 2>/dev/null || docker compose build --no-cache; then
        print_success "镜像构建成功"
    else
        print_error "镜像构建失败"
        return 1
    fi
}

# 启动服务
start_services() {
    print_header "启动 Docker 服务"
    
    cd "$PROJECT_ROOT"
    
    print_info "启动所有服务..."
    if docker-compose up -d 2>/dev/null || docker compose up -d; then
        print_success "服务启动成功"
        
        # 等待服务启动
        print_info "等待服务启动..."
        sleep 10
        
        # 检查服务状态
        check_service_status
    else
        print_error "服务启动失败"
        return 1
    fi
}

# 停止服务
stop_services() {
    print_header "停止 Docker 服务"
    
    cd "$PROJECT_ROOT"
    
    print_info "停止所有服务..."
    if docker-compose down 2>/dev/null || docker compose down; then
        print_success "服务停止成功"
    else
        print_error "服务停止失败"
        return 1
    fi
}

# 查看服务状态
check_service_status() {
    print_header "服务状态检查"
    
    cd "$PROJECT_ROOT"
    
    # 检查容器状态
    print_info "容器状态:"
    if docker-compose ps 2>/dev/null || docker compose ps; then
        echo ""
    else
        print_error "无法获取容器状态"
        return 1
    fi
    
    # 检查健康状态
    print_info "健康检查:"
    
    SERVICES=("jiffoo-postgres" "jiffoo-redis" "jiffoo-backend")
    
    for service in "${SERVICES[@]}"; do
        if docker ps --filter "name=$service" --filter "status=running" | grep -q "$service"; then
            print_success "$service 正在运行"
            
            # 检查健康状态
            HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "no-healthcheck")
            if [ "$HEALTH" = "healthy" ]; then
                print_success "$service 健康检查通过"
            elif [ "$HEALTH" = "no-healthcheck" ]; then
                print_info "$service 无健康检查配置"
            else
                print_warning "$service 健康检查状态: $HEALTH"
            fi
        else
            print_error "$service 未运行"
        fi
    done
}

# 查看日志
view_logs() {
    print_header "服务日志"
    
    cd "$PROJECT_ROOT"
    
    print_info "显示最近的日志..."
    if docker-compose logs --tail=50 2>/dev/null || docker compose logs --tail=50; then
        echo ""
    else
        print_error "无法获取日志"
        return 1
    fi
}

# 测试服务连接
test_services() {
    print_header "服务连接测试"
    
    # 测试 PostgreSQL
    print_info "测试 PostgreSQL 连接..."
    if docker exec jiffoo-postgres pg_isready -U jiffoo -d jiffoo_mall &> /dev/null; then
        print_success "PostgreSQL 连接正常"
    else
        print_error "PostgreSQL 连接失败"
    fi
    
    # 测试 Redis
    print_info "测试 Redis 连接..."
    if docker exec jiffoo-redis redis-cli ping | grep -q "PONG"; then
        print_success "Redis 连接正常"
    else
        print_error "Redis 连接失败"
    fi
    
    # 测试 Backend API
    print_info "测试 Backend API..."
    sleep 5  # 等待服务完全启动
    
    if curl -f -s http://localhost:8001/health > /dev/null; then
        print_success "Backend API 响应正常"
    else
        print_warning "Backend API 可能还在启动中，请稍后再试"
    fi
    
    # 显示可用的端点
    print_info "可用的服务端点:"
    echo "  - Backend API: http://localhost:8001"
    echo "  - API 文档: http://localhost:8001/docs"
    echo "  - Frontend: http://localhost:3000"
    echo "  - Admin: http://localhost:3001"
    echo "  - PostgreSQL: localhost:5432"
    echo "  - Redis: localhost:6379"
}

# 清理环境
clean_environment() {
    print_header "清理 Docker 环境"
    
    cd "$PROJECT_ROOT"
    
    print_warning "这将删除所有容器、镜像和数据卷"
    read -p "确定要继续吗？(y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "操作已取消"
        return 0
    fi
    
    # 停止并删除容器
    print_info "停止并删除容器..."
    docker-compose down -v --remove-orphans 2>/dev/null || docker compose down -v --remove-orphans
    
    # 删除镜像
    print_info "删除相关镜像..."
    docker images | grep jiffoo | awk '{print $3}' | xargs -r docker rmi -f
    
    # 清理未使用的资源
    print_info "清理未使用的 Docker 资源..."
    docker system prune -f
    
    print_success "环境清理完成"
}

# 重置环境
reset_environment() {
    print_header "重置 Docker 环境"
    
    clean_environment
    build_images
    start_services
    test_services
}

# 主函数
main() {
    case $1 in
        -h|--help)
            show_help
            ;;
        -c|--check)
            check_docker_environment
            ;;
        -b|--build)
            build_images
            ;;
        -u|--up)
            start_services
            ;;
        -d|--down)
            stop_services
            ;;
        -l|--logs)
            view_logs
            ;;
        -s|--status)
            check_service_status
            ;;
        -t|--test)
            test_services
            ;;
        --clean)
            clean_environment
            ;;
        --reset)
            reset_environment
            ;;
        *)
            print_info "运行基础检查（使用 --help 查看更多选项）"
            check_docker_environment
            ;;
    esac
}

# 如果脚本被直接执行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

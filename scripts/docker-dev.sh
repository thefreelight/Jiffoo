#!/bin/bash
# Jiffoo Mall - Docker 开发环境启动脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Jiffoo Mall Docker 开发环境${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}错误: Docker 未运行，请先启动 Docker${NC}"
    exit 1
fi

# 解析命令行参数
COMMAND=${1:-"up"}
COMPOSE_FILE="docker-compose.dev.yml"

case $COMMAND in
    "up"|"start")
        echo -e "${GREEN}启动基础设施服务...${NC}"
        docker-compose -f $COMPOSE_FILE up -d
        
        echo -e "\n${GREEN}等待服务就绪...${NC}"
        sleep 5
        
        echo -e "\n${GREEN}✅ 服务已启动！${NC}"
        echo -e "\n${YELLOW}服务地址:${NC}"
        echo -e "  PostgreSQL:      localhost:5432"
        echo -e "  Redis:           localhost:6379"
        echo -e "  MinIO API:       http://localhost:9000"
        echo -e "  MinIO Console:   http://localhost:9001"
        echo -e "  Mailhog:         http://localhost:8025"
        echo -e "  pgAdmin:         http://localhost:5050"
        echo -e "  Redis Commander: http://localhost:8081"
        
        echo -e "\n${YELLOW}现在可以运行应用:${NC}"
        echo -e "  pnpm dev"
        ;;
        
    "down"|"stop")
        echo -e "${YELLOW}停止所有服务...${NC}"
        docker-compose -f $COMPOSE_FILE down
        echo -e "${GREEN}✅ 服务已停止${NC}"
        ;;
        
    "restart")
        echo -e "${YELLOW}重启服务...${NC}"
        docker-compose -f $COMPOSE_FILE restart
        echo -e "${GREEN}✅ 服务已重启${NC}"
        ;;
        
    "logs")
        SERVICE=${2:-""}
        docker-compose -f $COMPOSE_FILE logs -f $SERVICE
        ;;
        
    "status"|"ps")
        docker-compose -f $COMPOSE_FILE ps
        ;;
        
    "clean")
        echo -e "${RED}警告: 这将删除所有数据卷！${NC}"
        read -p "确定要继续吗? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose -f $COMPOSE_FILE down -v
            echo -e "${GREEN}✅ 已清理所有容器和数据卷${NC}"
        fi
        ;;
        
    "db-shell")
        echo -e "${BLUE}连接到 PostgreSQL...${NC}"
        docker exec -it jiffoo-postgres-dev psql -U postgres -d jiffoo_mall
        ;;
        
    "redis-cli")
        echo -e "${BLUE}连接到 Redis...${NC}"
        docker exec -it jiffoo-redis-dev redis-cli
        ;;
        
    "help"|*)
        echo -e "${YELLOW}用法: ./scripts/docker-dev.sh [命令]${NC}"
        echo ""
        echo "命令:"
        echo "  up, start    启动所有基础设施服务"
        echo "  down, stop   停止所有服务"
        echo "  restart      重启所有服务"
        echo "  logs [服务]  查看日志 (可选指定服务名)"
        echo "  status, ps   查看服务状态"
        echo "  clean        停止服务并删除所有数据卷"
        echo "  db-shell     连接到 PostgreSQL 命令行"
        echo "  redis-cli    连接到 Redis 命令行"
        echo "  help         显示此帮助信息"
        ;;
esac

#!/bin/bash

# Jiffoo Mall 状态查看脚本
echo "📊 Jiffoo Mall 服务状态："
echo ""

docker-compose -f docker-compose.dev.yml ps

echo ""
echo "🌐 服务访问地址："
echo "  🛍️  前端商城:      http://localhost:3000"
echo "  ⚙️  管理后台:      http://localhost:3001"
echo "  📊 后端API:       http://localhost:8001"
echo "  📚 API文档:       http://localhost:8001/docs"
echo "  🗄️  PostgreSQL:    localhost:5433"
echo "  🔴 Redis:         localhost:6380"
echo ""
echo "💡 查看日志: docker-compose -f docker-compose.dev.yml logs -f [服务名]"

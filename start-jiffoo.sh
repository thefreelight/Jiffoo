#!/bin/bash

# Jiffoo Mall 一键启动脚本
echo "🚀 启动 Jiffoo Mall 开发环境..."

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker未运行，请先启动Docker"
    exit 1
fi

echo "📊 启动数据库和缓存服务..."
docker-compose -f docker-compose.dev.yml up -d postgres redis

echo "⏳ 等待数据库启动..."
sleep 15

echo "🔧 启动后端API服务..."
docker-compose -f docker-compose.dev.yml up -d backend

echo "⏳ 等待后端服务启动..."
sleep 20

echo "🎨 启动前端和管理后台..."
docker-compose -f docker-compose.dev.yml up -d frontend admin

echo "✅ 启动完成！"
echo ""
echo "🌐 服务访问地址："
echo "  🛍️  前端商城:      http://localhost:3000"
echo "  ⚙️  管理后台:      http://localhost:3001"
echo "  📊 后端API:       http://localhost:8001"
echo "  📚 API文档:       http://localhost:8001/docs"
echo "  🗄️  PostgreSQL:    localhost:5433"
echo "  🔴 Redis:         localhost:6380"
echo ""
echo "💡 查看日志: docker-compose -f docker-compose.dev.yml logs -f"
echo "💡 停止服务: docker-compose -f docker-compose.dev.yml down"

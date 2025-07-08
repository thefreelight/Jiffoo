#!/bin/bash

# Jiffoo Mall 停止脚本
echo "🛑 停止 Jiffoo Mall 开发环境..."

docker-compose -f docker-compose.dev.yml down

echo "✅ 所有服务已停止"
echo ""
echo "💡 如需清理数据: docker-compose -f docker-compose.dev.yml down -v"
echo "💡 重新启动: ./start-jiffoo.sh"

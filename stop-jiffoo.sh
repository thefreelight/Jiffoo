#!/bin/bash

# Jiffoo OSS local development shutdown helper
echo "🛑 Stopping the Jiffoo OSS local development environment..."

docker-compose -f docker-compose.dev.yml down

echo "✅ All services have been stopped"
echo ""
echo "💡 Remove local data: docker-compose -f docker-compose.dev.yml down -v"
echo "💡 Start again: ./start-jiffoo.sh"

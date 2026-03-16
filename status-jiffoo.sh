#!/bin/bash

# Jiffoo OSS local development status helper
echo "📊 Jiffoo OSS service status:"
echo ""

docker-compose -f docker-compose.dev.yml ps

echo ""
echo "🌐 Local endpoints:"
echo "  🛍️  Storefront:    http://localhost:3000"
echo "  ⚙️  Admin:         http://localhost:3001"
echo "  📊 API:           http://localhost:8001"
echo "  📚 API docs:      http://localhost:8001/docs"
echo "  🗄️  PostgreSQL:    localhost:5433"
echo "  🔴 Redis:         localhost:6380"
echo ""
echo "💡 Stream logs: docker-compose -f docker-compose.dev.yml logs -f [service]"

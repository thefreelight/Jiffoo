#!/bin/bash

# Health Check Script for Jiffoo Mall
set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo "🏥 Jiffoo Mall Health Check"
echo "=========================="

# Check if services are running
print_info "Checking service status..."

# Check containers
CONTAINERS=(
    "jiffoo-postgres"
    "jiffoo-redis"
    "jiffoo-backend"
    "jiffoo-frontend"
    "jiffoo-admin"
    "jiffoo-nginx"
)

for container in "${CONTAINERS[@]}"; do
    if docker ps --format "table {{.Names}}" | grep -q "$container"; then
        print_status "$container is running"
    else
        print_error "$container is not running"
    fi
done

echo ""
print_info "Checking service health..."

# Check PostgreSQL
if docker exec jiffoo-postgres pg_isready -U jiffoo > /dev/null 2>&1; then
    print_status "PostgreSQL is healthy"
else
    print_error "PostgreSQL is not healthy"
fi

# Check Redis
if docker exec jiffoo-redis redis-cli ping > /dev/null 2>&1; then
    print_status "Redis is healthy"
else
    print_error "Redis is not healthy"
fi

# Check Backend API
if curl -f -s http://localhost:3001/health > /dev/null; then
    print_status "Backend API is healthy"
else
    print_error "Backend API is not healthy"
fi

# Check Frontend
if curl -f -s http://localhost:3002 > /dev/null; then
    print_status "Frontend is healthy"
else
    print_error "Frontend is not healthy"
fi

# Check Admin
if curl -f -s http://localhost:3003 > /dev/null; then
    print_status "Admin dashboard is healthy"
else
    print_error "Admin dashboard is not healthy"
fi

# Check Nginx
if curl -f -s http://localhost > /dev/null; then
    print_status "Nginx is healthy"
else
    print_error "Nginx is not healthy"
fi

echo ""
print_info "Resource usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

echo ""
print_info "Recent logs (last 10 lines):"
echo "Backend:"
docker logs --tail 10 jiffoo-backend 2>/dev/null | tail -5

echo ""
echo "Frontend:"
docker logs --tail 10 jiffoo-frontend 2>/dev/null | tail -5

echo ""
echo "Admin:"
docker logs --tail 10 jiffoo-admin 2>/dev/null | tail -5

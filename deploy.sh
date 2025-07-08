#!/bin/bash

# Jiffoo Mall Production Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo "🚀 Jiffoo Mall Production Deployment"
echo "======================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env.production.local exists
if [ ! -f ".env.production.local" ]; then
    print_warning ".env.production.local not found. Creating from template..."
    cp .env.production .env.production.local
    print_info "Please edit .env.production.local with your configuration before continuing."
    read -p "Press Enter after editing the environment file..."
fi

# Load environment variables
export $(cat .env.production.local | grep -v '^#' | xargs)

print_info "Starting deployment process..."

# Stop existing containers
print_info "Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

# Pull latest images
print_info "Pulling latest base images..."
docker-compose -f docker-compose.prod.yml pull postgres redis nginx

# Build application images
print_info "Building application images..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Create necessary directories
print_info "Creating necessary directories..."
mkdir -p logs
mkdir -p ssl
mkdir -p backups

# Start services
print_info "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
print_info "Waiting for services to be ready..."
sleep 30

# Check service health
print_info "Checking service health..."

# Check PostgreSQL
if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U ${POSTGRES_USER:-jiffoo} > /dev/null 2>&1; then
    print_status "PostgreSQL is ready"
else
    print_error "PostgreSQL is not ready"
fi

# Check Redis
if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
    print_status "Redis is ready"
else
    print_error "Redis is not ready"
fi

# Check Backend
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    print_status "Backend is ready"
else
    print_error "Backend is not ready"
fi

# Check Frontend
if curl -f http://localhost:3002 > /dev/null 2>&1; then
    print_status "Frontend is ready"
else
    print_error "Frontend is not ready"
fi

# Check Admin
if curl -f http://localhost:3003 > /dev/null 2>&1; then
    print_status "Admin dashboard is ready"
else
    print_error "Admin dashboard is not ready"
fi

# Show running containers
print_info "Running containers:"
docker-compose -f docker-compose.prod.yml ps

print_status "Deployment completed!"

echo ""
echo "🎉 Jiffoo Mall is now running!"
echo ""
echo "📱 Services:"
echo "   Frontend:  http://localhost:3002"
echo "   Admin:     http://localhost:3003"
echo "   Backend:   http://localhost:3001"
echo ""
echo "🔧 Management:"
echo "   View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "   Stop:      docker-compose -f docker-compose.prod.yml down"
echo "   Restart:   docker-compose -f docker-compose.prod.yml restart"
echo ""
echo "📊 Monitoring:"
echo "   docker-compose -f docker-compose.prod.yml ps"
echo "   docker-compose -f docker-compose.prod.yml top"
echo ""

if [ ! -z "$DOMAIN" ] && [ "$DOMAIN" != "your-domain.com" ]; then
    echo "🌐 Configure your DNS:"
    echo "   A record: $DOMAIN -> $(curl -s ifconfig.me)"
    echo "   A record: admin.$DOMAIN -> $(curl -s ifconfig.me)"
    echo ""
fi

print_warning "Don't forget to:"
echo "1. Configure your domain DNS records"
echo "2. Set up SSL certificates for HTTPS"
echo "3. Configure firewall rules"
echo "4. Set up monitoring and backups"

#!/bin/bash
# Jiffoo Mall - One-Click Installation Script
# Usage: curl -fsSL https://raw.githubusercontent.com/jiffoo/mall/main/scripts/install.sh | bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           Jiffoo Mall Installation Script                 ║"
echo "║           Multi-Tenant E-commerce Platform                ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check requirements
check_requirements() {
    echo -e "${YELLOW}Checking requirements...${NC}"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
        echo "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${RED}Docker Compose is not installed.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Docker and Docker Compose are installed${NC}"
}

# Generate secure passwords
generate_password() {
    openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32
}

# Create environment file
create_env_file() {
    echo -e "${YELLOW}Creating environment configuration...${NC}"
    
    if [ -f .env.production ]; then
        echo -e "${YELLOW}Found existing .env.production, backing up...${NC}"
        cp .env.production .env.production.backup
    fi
    
    # Generate passwords
    DB_PASSWORD=$(generate_password)
    REDIS_PASSWORD=$(generate_password)
    JWT_SECRET=$(generate_password)
    
    cat > .env.production << EOF
# Jiffoo Mall Production Environment
# Generated on $(date)

# Domain Configuration
DOMAIN=${DOMAIN:-localhost}
ACME_EMAIL=${ACME_EMAIL:-admin@example.com}

# Database
DB_USER=postgres
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=jiffoo_mall

# Redis
REDIS_PASSWORD=${REDIS_PASSWORD}

# Security
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://${DOMAIN:-localhost}

# Optional: Payment (Stripe)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Optional: Email (Resend)
RESEND_API_KEY=

# Optional: OAuth (Google)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Registry (for custom builds)
REGISTRY=ghcr.io/jiffoo
VERSION=latest
EOF

    echo -e "${GREEN}✓ Environment file created${NC}"
    echo -e "${YELLOW}Important: Save these credentials securely!${NC}"
    echo "  Database Password: ${DB_PASSWORD}"
    echo "  Redis Password: ${REDIS_PASSWORD}"
}

# Pull or build images
setup_images() {
    echo -e "${YELLOW}Setting up Docker images...${NC}"
    
    if [ "$BUILD_LOCAL" = "true" ]; then
        echo "Building images locally..."
        docker-compose -f docker-compose.prod.yml build
    else
        echo "Pulling pre-built images..."
        docker-compose -f docker-compose.prod.yml pull || {
            echo -e "${YELLOW}Pre-built images not available, building locally...${NC}"
            docker-compose -f docker-compose.prod.yml build
        }
    fi
    
    echo -e "${GREEN}✓ Images ready${NC}"
}

# Start services
start_services() {
    echo -e "${YELLOW}Starting services...${NC}"
    
    # Load environment
    export $(cat .env.production | grep -v '^#' | xargs)
    
    # Start infrastructure first
    docker-compose -f docker-compose.prod.yml up -d postgres redis
    
    echo "Waiting for database to be ready..."
    sleep 10
    
    # Run migrations
    docker-compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy
    
    # Start all services
    docker-compose -f docker-compose.prod.yml up -d
    
    echo -e "${GREEN}✓ All services started${NC}"
}

# Print success message
print_success() {
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║           Installation Complete!                          ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "Access your Jiffoo Mall:"
    echo "  - Shop:   http://${DOMAIN:-localhost}"
    echo "  - Admin:  http://admin.${DOMAIN:-localhost}"
    echo "  - Tenant: http://tenant.${DOMAIN:-localhost}"
    echo "  - API:    http://api.${DOMAIN:-localhost}"
    echo ""
    echo "Complete the installation wizard at: http://admin.${DOMAIN:-localhost}/install"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Complete the installation wizard"
    echo "  2. Configure your domain DNS"
    echo "  3. Set up SSL certificates"
    echo "  4. Configure payment and email providers"
}

# Main
main() {
    check_requirements
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain) DOMAIN="$2"; shift 2 ;;
            --email) ACME_EMAIL="$2"; shift 2 ;;
            --build) BUILD_LOCAL="true"; shift ;;
            *) shift ;;
        esac
    done
    
    create_env_file
    setup_images
    start_services
    print_success
}

main "$@"


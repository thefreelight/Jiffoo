#!/bin/bash

# Jiffoo Mall Docker Development Environment
# This script provides easy commands to manage the development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  Jiffoo Mall Development${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Start development environment
start_dev() {
    print_header
    print_status "Starting Jiffoo Mall development environment..."
    
    check_docker
    
    # Stop any existing containers
    docker-compose -f docker-compose.dev.yml down
    
    # Start services
    print_status "Starting services..."
    docker-compose -f docker-compose.dev.yml up -d postgres redis
    
    print_status "Waiting for database to be ready..."
    sleep 10
    
    print_status "Starting backend..."
    docker-compose -f docker-compose.dev.yml up -d backend
    
    print_status "Waiting for backend to be ready..."
    sleep 15
    
    print_status "Starting frontend and admin..."
    docker-compose -f docker-compose.dev.yml up -d frontend admin
    
    print_status "Development environment started successfully!"
    echo ""
    echo -e "${GREEN}🚀 Services are running:${NC}"
    echo -e "  📊 Backend API:     ${BLUE}http://localhost:8001${NC}"
    echo -e "  📚 API Docs:        ${BLUE}http://localhost:8001/docs${NC}"
    echo -e "  🛍️  Frontend:        ${BLUE}http://localhost:3000${NC}"
    echo -e "  ⚙️  Admin Dashboard: ${BLUE}http://localhost:3001${NC}"
    echo -e "  🗄️  PostgreSQL:      ${BLUE}localhost:5433${NC}"
    echo -e "  🔴 Redis:           ${BLUE}localhost:6380${NC}"
    echo ""
    echo -e "${YELLOW}💡 Use 'docker-dev.sh logs' to view logs${NC}"
    echo -e "${YELLOW}💡 Use 'docker-dev.sh stop' to stop all services${NC}"
}

# Stop development environment
stop_dev() {
    print_status "Stopping Jiffoo Mall development environment..."
    docker-compose -f docker-compose.dev.yml down
    print_status "Development environment stopped."
}

# Show logs
show_logs() {
    if [ -z "$2" ]; then
        print_status "Showing logs for all services..."
        docker-compose -f docker-compose.dev.yml logs -f
    else
        print_status "Showing logs for $2..."
        docker-compose -f docker-compose.dev.yml logs -f "$2"
    fi
}

# Restart a service
restart_service() {
    if [ -z "$2" ]; then
        print_error "Please specify a service to restart (backend, frontend, admin, postgres, redis)"
        exit 1
    fi
    
    print_status "Restarting $2..."
    docker-compose -f docker-compose.dev.yml restart "$2"
    print_status "$2 restarted successfully."
}

# Show status
show_status() {
    print_status "Development environment status:"
    docker-compose -f docker-compose.dev.yml ps
}

# Clean up (remove containers and volumes)
cleanup() {
    print_warning "This will remove all containers and volumes. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_status "Cleaning up development environment..."
        docker-compose -f docker-compose.dev.yml down -v
        docker system prune -f
        print_status "Cleanup completed."
    else
        print_status "Cleanup cancelled."
    fi
}

# Show help
show_help() {
    print_header
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start the development environment"
    echo "  stop      Stop the development environment"
    echo "  restart   Restart all services or a specific service"
    echo "  logs      Show logs for all services or a specific service"
    echo "  status    Show status of all services"
    echo "  cleanup   Remove all containers and volumes"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start                    # Start all services"
    echo "  $0 logs backend             # Show backend logs"
    echo "  $0 restart frontend         # Restart frontend service"
    echo "  $0 stop                     # Stop all services"
}

# Main script logic
case "${1:-help}" in
    start)
        start_dev
        ;;
    stop)
        stop_dev
        ;;
    restart)
        restart_service "$@"
        ;;
    logs)
        show_logs "$@"
        ;;
    status)
        show_status
        ;;
    cleanup)
        cleanup
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac

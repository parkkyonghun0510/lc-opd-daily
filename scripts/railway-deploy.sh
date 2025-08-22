#!/bin/bash

# Railway Deployment Script
# Automates the deployment process to Railway

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Railway CLI is installed
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        print_error "Railway CLI is not installed"
        print_status "Installing Railway CLI..."
        npm install -g @railway/cli
    else
        print_success "Railway CLI is installed"
    fi
}

# Check if user is logged in to Railway
check_railway_auth() {
    if ! railway whoami &> /dev/null; then
        print_error "Not logged in to Railway"
        print_status "Please run 'railway login' first"
        exit 1
    else
        print_success "Authenticated with Railway"
    fi
}

# Validate environment
validate_environment() {
    print_status "Validating environment..."
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_error "package.json not found"
        exit 1
    fi
    
    # Check if Dockerfile exists
    if [ ! -f "Dockerfile" ]; then
        print_error "Dockerfile not found"
        exit 1
    fi
    
    # Check if railway.json exists
    if [ ! -f "railway.json" ]; then
        print_error "railway.json not found"
        exit 1
    fi
    
    print_success "Environment validation passed"
}

# Build and test locally (optional)
local_build_test() {
    if [ "$1" = "--skip-local-test" ]; then
        print_warning "Skipping local build test"
        return
    fi
    
    print_status "Running local build test..."
    
    # Install dependencies
    npm ci --legacy-peer-deps
    
    # Run linting
    npm run lint || {
        print_warning "Linting failed, but continuing..."
    }
    
    # Run type checking
    npm run type-check || {
        print_warning "Type checking failed, but continuing..."
    }
    
    # Build the application
    npm run build:railway
    
    print_success "Local build test completed"
}

# Deploy to Railway
deploy_to_railway() {
    local environment=${1:-production}
    
    print_status "Deploying to Railway environment: $environment"
    
    # Deploy using Railway CLI
    if [ "$environment" = "production" ]; then
        railway up --detach
    else
        railway up --detach --environment "$environment"
    fi
    
    print_success "Deployment initiated successfully"
}

# Monitor deployment
monitor_deployment() {
    print_status "Monitoring deployment status..."
    
    # Wait for deployment to complete
    sleep 10
    
    # Check deployment status
    railway status
    
    print_status "Deployment monitoring completed"
}

# Main deployment function
main() {
    local environment="production"
    local skip_local_test=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                environment="$2"
                shift 2
                ;;
            --skip-local-test)
                skip_local_test=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  -e, --environment ENV    Deploy to specific environment (default: production)"
                echo "  --skip-local-test        Skip local build testing"
                echo "  -h, --help              Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    print_status "🚀 Starting Railway deployment process..."
    print_status "Environment: $environment"
    
    # Run deployment steps
    check_railway_cli
    check_railway_auth
    validate_environment
    
    if [ "$skip_local_test" = false ]; then
        local_build_test
    else
        local_build_test --skip-local-test
    fi
    
    deploy_to_railway "$environment"
    monitor_deployment
    
    print_success "🎉 Railway deployment completed successfully!"
    print_status "Your application should be available at your Railway domain"
}

# Run main function with all arguments
main "$@"
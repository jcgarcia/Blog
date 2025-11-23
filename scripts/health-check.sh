#!/bin/bash

# Blog Health Check Script
# This script checks the health of the blog services

set -e

echo "🔍 Blog Health Check Script"
echo "=========================="

# Color codes for output
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

# Check external URLs
print_status "🌐 Checking external URLs..."

# Check frontend
if curl -f -s https://bedtime.ingasti.com/health &> /dev/null; then
    print_success "✅ Frontend (bedtime.ingasti.com) is healthy"
else
    print_error "❌ Frontend (bedtime.ingasti.com) is not responding"
fi

# Check backend
if curl -f -s https://bapi.ingasti.com/health &> /dev/null; then
    print_success "✅ Backend (bapi.ingasti.com) is healthy"
else
    print_error "❌ Backend (bapi.ingasti.com) is not responding"
fi

# Check if kubectl is available
if command -v kubectl &> /dev/null; then
    print_status "☸️  Checking Kubernetes status..."
    
    # Check if blog namespace exists
    if kubectl get namespace blog &> /dev/null; then
        print_success "✅ Blog namespace exists"
        
        # Check pods
        print_status "📋 Pod status:"
        kubectl get pods -n blog -o wide
        
        # Check services
        print_status "🌐 Service status:"
        kubectl get services -n blog
        
        # Check ingress
        print_status "🌐 Ingress status:"
        kubectl get ingress -n blog
        
        # Check recent events
        print_status "📅 Recent events:"
        kubectl get events -n blog --sort-by=.metadata.creationTimestamp | tail -10
        
        # Internal health checks
        print_status "🏥 Internal health checks..."
        kubectl run health-check --image=busybox --rm -i --restart=Never --timeout=30s -- /bin/sh -c "wget -qO- http://blog-backend-service.blog.svc.cluster.local/health && echo 'Backend internal health: OK'" 2>/dev/null || print_warning "⚠️  Backend internal health check failed"
        
        kubectl run health-check --image=busybox --rm -i --restart=Never --timeout=30s -- /bin/sh -c "wget -qO- http://blog-frontend-service.blog.svc.cluster.local/health && echo 'Frontend internal health: OK'" 2>/dev/null || print_warning "⚠️  Frontend internal health check failed"
        
    else
        print_warning "⚠️  Blog namespace not found"
    fi
else
    print_warning "⚠️  kubectl not available - skipping Kubernetes checks"
fi

# Check if Docker is available
if command -v docker &> /dev/null; then
    print_status "🐳 Checking Docker containers..."
    
    # Check if any blog containers are running
    if docker ps | grep -q blog; then
        print_status "📋 Running blog containers:"
        docker ps --filter "name=blog" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    else
        print_status "ℹ️  No blog Docker containers currently running"
    fi
    
    # Check local registry
    if curl -f http://localhost:5000/v2/_catalog &> /dev/null; then
        print_success "✅ Local Docker registry is running"
        
        # Check if blog images exist
        if curl -s http://localhost:5000/v2/blog-frontend/tags/list | jq -r '.tags[]' | head -5 &> /dev/null; then
            print_status "📦 Available frontend images:"
            curl -s http://localhost:5000/v2/blog-frontend/tags/list | jq -r '.tags[]' | head -5
        fi
        
        if curl -s http://localhost:5000/v2/blog-backend/tags/list | jq -r '.tags[]' | head -5 &> /dev/null; then
            print_status "📦 Available backend images:"
            curl -s http://localhost:5000/v2/blog-backend/tags/list | jq -r '.tags[]' | head -5
        fi
    else
        print_warning "⚠️  Local Docker registry is not running"
    fi
else
    print_warning "⚠️  Docker not available - skipping Docker checks"
fi

print_status "🔍 Health check completed"

#!/bin/bash

# Blog Kubernetes Deployment Script
# This script deploys the blog application to Kubernetes

set -e

echo "🚀 Blog Kubernetes Deployment Script"
echo "=================================="

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

# Check if we're running on the cloud server
if [ "$USER" != "jenkins-agent" ] && [ "$USER" != "root" ]; then
    print_warning "This script should be run on the cloud server as jenkins-agent or root user"
    print_warning "Current user: $USER"
    print_warning "Continue anyway? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
    exit 1
fi

# Check if we can connect to Kubernetes
if ! kubectl version --client &> /dev/null; then
    print_error "Cannot connect to Kubernetes cluster"
    exit 1
fi

print_status "✅ Prerequisites check passed"

# Set image tag (default to latest if not provided)
IMAGE_TAG=${1:-latest}
FRONTEND_IMAGE="localhost:5000/blog-frontend:${IMAGE_TAG}"
BACKEND_IMAGE="localhost:5000/blog-backend:${IMAGE_TAG}"

print_status "🏗️ Using images:"
print_status "  Frontend: $FRONTEND_IMAGE"
print_status "  Backend: $BACKEND_IMAGE"

# Check if images exist in registry
print_status "🔍 Checking if images exist in registry..."
if curl -s http://localhost:5000/v2/blog-frontend/tags/list | grep -q "\"$IMAGE_TAG\""; then
    print_success "Frontend image found in registry"
else
    print_error "Frontend image not found in registry. Build and push first."
    exit 1
fi

if curl -s http://localhost:5000/v2/blog-backend/tags/list | grep -q "\"$IMAGE_TAG\""; then
    print_success "Backend image found in registry"
else
    print_error "Backend image not found in registry. Build and push first."
    exit 1
fi

# Create namespace and secrets
print_status "📝 Creating namespace and secrets..."
kubectl apply -f k8s/namespace.yaml

# Create persistent volumes
print_status "💾 Creating persistent volumes..."
kubectl apply -f k8s/storage.yaml

# Wait for namespace to be ready
kubectl wait --for=condition=Ready --timeout=60s namespace/blog 2>/dev/null || true

# Update image tags in deployment files
print_status "📝 Updating deployment manifests with image tags..."
sed -i.bak "s|localhost:5000/blog-frontend:latest|$FRONTEND_IMAGE|g" k8s/frontend-deployment.yaml
sed -i.bak "s|localhost:5000/blog-backend:latest|$BACKEND_IMAGE|g" k8s/backend-deployment.yaml

# Deploy backend
print_status "🚀 Deploying backend..."
kubectl apply -f k8s/backend-deployment.yaml

# Deploy frontend
print_status "🚀 Deploying frontend..."
kubectl apply -f k8s/frontend-deployment.yaml

# Wait for deployments to be ready
print_status "⏳ Waiting for deployments to be ready..."
print_status "Waiting for backend deployment..."
kubectl wait --for=condition=available --timeout=300s deployment/blog-backend -n blog

print_status "Waiting for frontend deployment..."
kubectl wait --for=condition=available --timeout=300s deployment/blog-frontend -n blog

# Check deployment status
print_status "📊 Deployment status:"
kubectl get all -n blog

# Check pod status
print_status "🔍 Checking pod status..."
kubectl get pods -n blog -o wide

# Perform health checks
print_status "🏥 Performing health checks..."

# Internal health check via service
print_status "Testing backend health..."
kubectl run health-check-backend --image=busybox --rm -i --restart=Never --timeout=60s -- /bin/sh -c "wget -qO- http://blog-backend-service.blog.svc.cluster.local/health && echo 'Backend health check passed'" || print_warning "Backend health check failed"

print_status "Testing frontend health..."
kubectl run health-check-frontend --image=busybox --rm -i --restart=Never --timeout=60s -- /bin/sh -c "wget -qO- http://blog-frontend-service.blog.svc.cluster.local/health && echo 'Frontend health check passed'" || print_warning "Frontend health check failed"

# Show recent logs
print_status "📋 Recent application logs:"
print_status "Backend logs:"
kubectl logs -n blog -l app=blog-backend --tail=10 2>/dev/null || print_warning "Could not fetch backend logs"

print_status "Frontend logs:"
kubectl logs -n blog -l app=blog-frontend --tail=10 2>/dev/null || print_warning "Could not fetch frontend logs"

# Restore original deployment files
print_status "🔄 Restoring original deployment files..."
mv k8s/frontend-deployment.yaml.bak k8s/frontend-deployment.yaml
mv k8s/backend-deployment.yaml.bak k8s/backend-deployment.yaml

print_success "🎉 Blog deployment completed successfully!"
print_success ""
print_success "📱 Services should be available at:"
print_success "  Frontend: https://bedtime.ingasti.com"
print_success "  Backend: https://bapi.ingasti.com"
print_success ""
print_success "🔍 Monitor with:"
print_success "  kubectl get pods -n blog -w"
print_success "  kubectl logs -f deployment/blog-backend -n blog"
print_success "  kubectl logs -f deployment/blog-frontend -n blog"

# Show service and ingress information
print_status "🌐 Service Information:"
kubectl get services -n blog
print_status "🌐 Ingress Information:"
kubectl get ingress -n blog

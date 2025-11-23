#!/bin/bash

# Blog Build and Test Script
# This script builds the blog images and pushes them to the local registry

set -e

echo "🚀 Blog Build and Push Script"
echo "============================"

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

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
    exit 1
fi

# Check if local registry is running
if ! curl -f http://localhost:5000/v2/_catalog &> /dev/null; then
    print_error "Local Docker registry is not running on localhost:5000"
    print_error "Please start the registry first: docker run -d -p 5000:5000 --name registry registry:2"
    exit 1
fi

# Set image tag (default to current timestamp)
IMAGE_TAG=${1:-$(date +%s)}
FRONTEND_IMAGE="localhost:5000/blog-frontend:${IMAGE_TAG}"
BACKEND_IMAGE="localhost:5000/blog-backend:${IMAGE_TAG}"

print_status "🏗️ Building images with tag: $IMAGE_TAG"
print_status "  Frontend: $FRONTEND_IMAGE"
print_status "  Backend: $BACKEND_IMAGE"

# Build backend image
print_status "🔨 Building backend image..."
cd api
docker build -f Dockerfile.k8s -t "$BACKEND_IMAGE" .
docker tag "$BACKEND_IMAGE" "localhost:5000/blog-backend:latest"
cd ..

print_success "✅ Backend image built successfully"

# Build frontend image
print_status "🔨 Building frontend image..."
cd client
docker build -f Dockerfile.k8s -t "$FRONTEND_IMAGE" .
docker tag "$FRONTEND_IMAGE" "localhost:5000/blog-frontend:latest"
cd ..

print_success "✅ Frontend image built successfully"

# Push images to registry
print_status "📤 Pushing images to registry..."
docker push "$BACKEND_IMAGE"
docker push "localhost:5000/blog-backend:latest"
docker push "$FRONTEND_IMAGE"
docker push "localhost:5000/blog-frontend:latest"

print_success "✅ Images pushed to registry successfully"

# Test backend image
print_status "🧪 Testing backend image..."
docker run -d -p 5001:5000 --name test-backend-build \
    -e DATABASE_URL="mysql://test:test@test:3306/test" \
    -e JWT_SECRET="test-secret" \
    -e CORS_ORIGIN="https://bedtime.ingasti.com" \
    -e NODE_ENV=production \
    "$BACKEND_IMAGE"

sleep 10

if curl -f http://localhost:5001/health &> /dev/null; then
    print_success "✅ Backend container test passed"
else
    print_warning "⚠️  Backend health check failed (this might be expected if database is not accessible)"
fi

# Cleanup backend test
docker stop test-backend-build && docker rm test-backend-build

# Test frontend image
print_status "🧪 Testing frontend image..."
docker run -d -p 3001:80 --name test-frontend-build \
    -e NEXT_PUBLIC_API_URL="https://bapi.ingasti.com" \
    "$FRONTEND_IMAGE"

sleep 10

if curl -f http://localhost:3001/health &> /dev/null; then
    print_success "✅ Frontend container test passed"
else
    print_error "❌ Frontend health check failed"
    exit 1
fi

# Cleanup frontend test
docker stop test-frontend-build && docker rm test-frontend-build

# Verify images are in registry
print_status "🔍 Verifying images in registry..."
if curl -s http://localhost:5000/v2/blog-backend/tags/list | jq -r '.tags[]' | grep -q "$IMAGE_TAG"; then
    print_success "✅ Backend image verified in registry"
else
    print_error "❌ Backend image not found in registry"
    exit 1
fi

if curl -s http://localhost:5000/v2/blog-frontend/tags/list | jq -r '.tags[]' | grep -q "$IMAGE_TAG"; then
    print_success "✅ Frontend image verified in registry"
else
    print_error "❌ Frontend image not found in registry"
    exit 1
fi

print_success "🎉 Build and push completed successfully!"
print_success ""
print_success "📦 Images available:"
print_success "  Backend: $BACKEND_IMAGE"
print_success "  Frontend: $FRONTEND_IMAGE"
print_success ""
print_success "🚀 To deploy to Kubernetes, run:"
print_success "  cd k8s && ./deploy.sh $IMAGE_TAG"
print_success ""
print_success "🐳 To test with Docker Compose, run:"
print_success "  docker-compose -f docker-compose.prod.yml up -d"

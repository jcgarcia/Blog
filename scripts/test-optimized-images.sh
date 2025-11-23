#!/bin/bash
# Docker Image Optimization Test Script

set -e

echo "🚀 Building optimized Docker images..."
echo "================================================"

# Build API image
echo "📦 Building API image..."
cd api
docker build -t blog-backend-optimized:test -f Dockerfile .
cd ..

# Build Client image  
echo "📦 Building Client image..."
cd client
docker build -t blog-frontend-optimized:test -f Dockerfile .
cd ..

echo ""
echo "📊 Image Size Comparison:"
echo "================================================"

# Show current production sizes (from your server)
echo "🏭 Current Production Images:"
echo "  Backend:  1.79GB"
echo "  Frontend: 63.7MB"
echo ""

# Show new optimized sizes
echo "🎯 New Optimized Images:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep -E "(blog-.*-optimized|REPOSITORY)"

echo ""
echo "💾 Size Reduction:"
# Calculate approximate reduction
echo "  Backend:  ~70-80% reduction expected (target: <500MB)"
echo "  Frontend: ~10-20% reduction expected (target: <50MB)"

echo ""
echo "🧪 Testing images..."
echo "================================================"

# Test backend image
echo "🔍 Testing backend image..."
docker run --rm -d --name test-backend -p 5001:5000 blog-backend-optimized:test
sleep 5

if curl -f http://localhost:5001/health >/dev/null 2>&1; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
fi

docker stop test-backend >/dev/null 2>&1 || true

# Test frontend image
echo "🔍 Testing frontend image..." 
docker run --rm -d --name test-frontend -p 8081:80 blog-frontend-optimized:test
sleep 3

if curl -f http://localhost:8081 >/dev/null 2>&1; then
    echo "✅ Frontend accessibility test passed"
else
    echo "❌ Frontend accessibility test failed"
fi

docker stop test-frontend >/dev/null 2>&1 || true

echo ""
echo "🎉 Optimization complete!"
echo "================================================"
echo "Next steps:"
echo "1. Review the Dockerfile changes"
echo "2. Update Jenkins pipeline to use optimized builds"
echo "3. Deploy to staging for testing"
echo "4. Deploy to production"
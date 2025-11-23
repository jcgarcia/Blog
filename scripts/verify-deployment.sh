#!/bin/bash

# Blog Deployment Verification Script
# This script verifies that the blog deployment is working correctly

echo "🔍 Blog Deployment Verification"
echo "==============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "Jenkinsfile" ]; then
    echo -e "${RED}❌ This script must be run from the blog code directory${NC}"
    exit 1
fi

echo "1. Docker Registry Check"
echo "------------------------"
curl -s -f http://localhost:5000/v2/ > /dev/null
print_status $? "Docker registry is accessible at localhost:5000"

# Check if images exist in registry
echo ""
echo "2. Docker Images Check"
echo "----------------------"
CATALOG=$(curl -s http://localhost:5000/v2/_catalog 2>/dev/null)
if echo "$CATALOG" | grep -q "blog-frontend"; then
    print_status 0 "Frontend images found in registry"
else
    print_status 1 "Frontend images not found in registry"
fi

if echo "$CATALOG" | grep -q "blog-backend"; then
    print_status 0 "Backend images found in registry"
else
    print_status 1 "Backend images not found in registry"
fi

echo ""
echo "3. Kubernetes Cluster Check"
echo "----------------------------"
kubectl cluster-info --request-timeout=5s > /dev/null 2>&1
print_status $? "Kubernetes cluster is accessible"

kubectl get nodes > /dev/null 2>&1
print_status $? "Kubernetes nodes are available"

echo ""
echo "4. Blog Namespace Check"
echo "-----------------------"
kubectl get namespace blog > /dev/null 2>&1
print_status $? "Blog namespace exists"

echo ""
echo "5. Blog Deployments Check"
echo "-------------------------"
kubectl get deployment blog-backend -n blog > /dev/null 2>&1
BACKEND_STATUS=$?
print_status $BACKEND_STATUS "Backend deployment exists"

kubectl get deployment blog-frontend -n blog > /dev/null 2>&1
FRONTEND_STATUS=$?
print_status $FRONTEND_STATUS "Frontend deployment exists"

if [ $BACKEND_STATUS -eq 0 ] && [ $FRONTEND_STATUS -eq 0 ]; then
    echo ""
    echo "6. Pod Status Check"
    echo "-------------------"
    kubectl get pods -n blog --no-headers | while read line; do
        POD_NAME=$(echo $line | awk '{print $1}')
        POD_STATUS=$(echo $line | awk '{print $3}')
        if [ "$POD_STATUS" = "Running" ]; then
            print_status 0 "Pod $POD_NAME is running"
        else
            print_status 1 "Pod $POD_NAME is $POD_STATUS"
        fi
    done
fi

echo ""
echo "7. Service Check"
echo "----------------"
kubectl get service blog-backend-service -n blog > /dev/null 2>&1
print_status $? "Backend service exists"

kubectl get service blog-frontend-service -n blog > /dev/null 2>&1
print_status $? "Frontend service exists"

echo ""
echo "8. Health Check"
echo "---------------"
# Internal health check using kubectl port-forward
kubectl port-forward -n blog service/blog-backend-service 8080:80 > /dev/null 2>&1 &
PF_PID=$!
sleep 3

curl -s -f http://localhost:8080/health > /dev/null 2>&1
HEALTH_STATUS=$?
kill $PF_PID 2>/dev/null
print_status $HEALTH_STATUS "Backend health endpoint is accessible"

echo ""
echo "9. External Access Check"
echo "------------------------"
# Check if external URLs are accessible (if DNS is configured)
if curl -s -f --connect-timeout 5 https://bapi.ingasti.com/health > /dev/null 2>&1; then
    print_status 0 "Backend is accessible via https://bapi.ingasti.com"
else
    print_warning "Backend not accessible via https://bapi.ingasti.com (DNS/proxy not configured yet)"
fi

if curl -s -f --connect-timeout 5 https://blog.ingasti.com > /dev/null 2>&1; then
    print_status 0 "Frontend is accessible via https://blog.ingasti.com"
else
    print_warning "Frontend not accessible via https://blog.ingasti.com (DNS/proxy not configured yet)"
fi

echo ""
echo "10. Summary"
echo "-----------"
echo "To monitor the deployment:"
echo "  kubectl get all -n blog"
echo "  kubectl logs -f deployment/blog-backend -n blog"
echo "  kubectl logs -f deployment/blog-frontend -n blog"
echo ""
echo "To access the services:"
echo "  Frontend: https://blog.ingasti.com"
echo "  Backend:  https://bapi.ingasti.com"
echo ""
echo "✅ Verification complete!"

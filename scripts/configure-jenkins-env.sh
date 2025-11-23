#!/bin/bash

# Jenkins Environment Configuration Script
# 
# ⚠️  IMPORTANT: This script must be run ON THE JENKINS SERVER, not locally!
# 
# Usage:
#   1. SSH into your Jenkins server: ssh user@your-jenkins-server.com
#   2. Upload or create this script on the Jenkins server
#   3. Run: ./configure-jenkins-env.sh
#
# This script helps configure the Jenkins environment for the blog deployment

echo "🔧 Jenkins Environment Configuration for Blog Deployment"
echo "========================================================"
echo ""
echo "⚠️  IMPORTANT: This script should be run ON THE JENKINS SERVER"
echo "    If you're running this locally, please SSH to your Jenkins server first."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Function to print info
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ This script should not be run as root${NC}"
   echo "Please run as a regular user with sudo privileges"
   exit 1
fi

echo ""
echo "1. System Prerequisites Check"
echo "-----------------------------"

# Check if Jenkins is installed
if systemctl is-active --quiet jenkins; then
    print_status 0 "Jenkins service is running"
else
    print_status 1 "Jenkins service is not running"
    echo "Please install and start Jenkins first"
    exit 1
fi

# Check if Docker is installed
if command -v docker &> /dev/null; then
    print_status 0 "Docker is installed"
else
    print_status 1 "Docker is not installed"
    echo "Please install Docker first"
    exit 1
fi

# Check if kubectl is installed
if command -v kubectl &> /dev/null; then
    print_status 0 "kubectl is installed"
else
    print_status 1 "kubectl is not installed"
    echo "Please install kubectl first"
    exit 1
fi

echo ""
echo "2. Jenkins User Configuration"
echo "-----------------------------"

# Check if jenkins user exists
if id "jenkins" &>/dev/null; then
    print_status 0 "Jenkins user exists"
else
    print_status 1 "Jenkins user does not exist"
    exit 1
fi

# Check if jenkins user is in docker group
if groups jenkins | grep -q docker; then
    print_status 0 "Jenkins user is in docker group"
else
    print_warning "Jenkins user is not in docker group"
    echo "Adding jenkins user to docker group..."
    sudo usermod -aG docker jenkins
    print_status 0 "Jenkins user added to docker group"
    echo "⚠️  You may need to restart Jenkins service"
fi

echo ""
echo "3. Docker Registry Check"
echo "------------------------"

# Check if Docker registry is running
if curl -s -f http://localhost:5000/v2/ > /dev/null 2>&1; then
    print_status 0 "Docker registry is accessible at localhost:5000"
else
    print_warning "Docker registry is not accessible"
    echo "Starting Docker registry..."
    
    # Check if registry container exists
    if docker ps -a --format "table {{.Names}}" | grep -q "registry"; then
        echo "Registry container exists, starting..."
        docker start registry
    else
        echo "Creating new registry container..."
        docker run -d -p 5000:5000 --restart=always --name registry registry:2
    fi
    
    sleep 5
    
    if curl -s -f http://localhost:5000/v2/ > /dev/null 2>&1; then
        print_status 0 "Docker registry is now accessible"
    else
        print_status 1 "Failed to start Docker registry"
    fi
fi

echo ""
echo "4. Kubernetes Configuration"
echo "---------------------------"

# Check if kubectl can connect to cluster
if kubectl cluster-info --request-timeout=5s > /dev/null 2>&1; then
    print_status 0 "Kubernetes cluster is accessible"
else
    print_status 1 "Kubernetes cluster is not accessible"
    echo "Please configure kubectl to connect to your cluster"
fi

# Check if jenkins user has kubernetes access
JENKINS_HOME="/var/lib/jenkins"
if [ -f "$JENKINS_HOME/.kube/config" ]; then
    print_status 0 "Jenkins user has kubernetes config"
else
    print_warning "Jenkins user does not have kubernetes config"
    
    if [ -f "/root/.kube/config" ]; then
        echo "Copying kubernetes config to jenkins user..."
        sudo mkdir -p "$JENKINS_HOME/.kube"
        sudo cp /root/.kube/config "$JENKINS_HOME/.kube/config"
        sudo chown -R jenkins:jenkins "$JENKINS_HOME/.kube"
        sudo chmod 600 "$JENKINS_HOME/.kube/config"
        print_status 0 "Kubernetes config copied to jenkins user"
    else
        print_status 1 "No kubernetes config found at /root/.kube/config"
        echo "Please configure kubectl first"
    fi
fi

# Test jenkins user kubernetes access
if sudo -u jenkins kubectl get nodes > /dev/null 2>&1; then
    print_status 0 "Jenkins user can access Kubernetes cluster"
else
    print_status 1 "Jenkins user cannot access Kubernetes cluster"
fi

echo ""
echo "5. Jenkins Service Configuration"
echo "--------------------------------"

# Check if Jenkins needs restart
if groups jenkins | grep -q docker && [ -f "$JENKINS_HOME/.kube/config" ]; then
    print_info "Checking if Jenkins service needs restart..."
    
    # Check if jenkins can access docker
    if sudo -u jenkins docker ps > /dev/null 2>&1; then
        print_status 0 "Jenkins user can access Docker"
    else
        print_warning "Jenkins user cannot access Docker - restart may be needed"
        read -p "Do you want to restart Jenkins service now? (y/N): " restart_choice
        if [[ $restart_choice =~ ^[Yy]$ ]]; then
            echo "Restarting Jenkins service..."
            sudo systemctl restart jenkins
            echo "Waiting for Jenkins to start..."
            sleep 10
            
            if systemctl is-active --quiet jenkins; then
                print_status 0 "Jenkins service restarted successfully"
            else
                print_status 1 "Failed to restart Jenkins service"
            fi
        fi
    fi
fi

echo ""
echo "6. Generate Sample Credentials"
echo "------------------------------"

print_info "Sample credentials for Jenkins configuration:"
echo ""

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)
echo "📝 JWT Secret (copy to Jenkins credential 'blog-jwt-secret'):"
echo "   $JWT_SECRET"
echo ""

# Sample database URLs
echo "📝 Database URL Examples (copy appropriate one to Jenkins credential 'blog-database-url'):"
echo "   MongoDB:    mongodb://username:password@hostname:27017/blog_database"
echo "   PostgreSQL: postgresql://username:password@hostname:5432/blog_database"
echo "   MySQL:      mysql://username:password@hostname:3306/blog_database"
echo ""

echo "7. Jenkins Plugin Check"
echo "-----------------------"

print_info "Required Jenkins plugins (install via Manage Jenkins > Plugins):"
echo "   - Pipeline"
echo "   - Docker Pipeline"
echo "   - Kubernetes"
echo "   - Credentials Binding"
echo "   - Git"
echo "   - Blue Ocean (optional)"

echo ""
echo "8. Final Configuration Steps"
echo "----------------------------"

print_info "Manual steps to complete in Jenkins UI:"
echo "1. Go to: Manage Jenkins > Credentials > System > Global credentials"
echo "2. Add credential: ID='blog-database-url', Type='Secret text'"
echo "3. Add credential: ID='blog-jwt-secret', Type='Secret text'"
echo "4. Create Multibranch Pipeline job pointing to your blog repository"
echo "5. Configure branch discovery to include 'workinprogress' branch"

echo ""
echo "9. Test Your Configuration"
echo "-------------------------"

print_info "After configuring Jenkins credentials, test with:"
echo "1. Create a simple test pipeline in Jenkins"
echo "2. Run the blog deployment pipeline"
echo "3. Use the verification script: ./verify-deployment.sh"

echo ""
echo "📋 Configuration Summary"
echo "========================"

# Summary of status
docker_status=$(docker ps > /dev/null 2>&1 && echo "✅ OK" || echo "❌ FAIL")
k8s_status=$(kubectl get nodes > /dev/null 2>&1 && echo "✅ OK" || echo "❌ FAIL")
registry_status=$(curl -s -f http://localhost:5000/v2/ > /dev/null 2>&1 && echo "✅ OK" || echo "❌ FAIL")
jenkins_docker=$(sudo -u jenkins docker ps > /dev/null 2>&1 && echo "✅ OK" || echo "❌ FAIL")
jenkins_k8s=$(sudo -u jenkins kubectl get nodes > /dev/null 2>&1 && echo "✅ OK" || echo "❌ FAIL")

echo "Docker:           $docker_status"
echo "Kubernetes:       $k8s_status"
echo "Registry:         $registry_status"
echo "Jenkins+Docker:   $jenkins_docker"
echo "Jenkins+K8s:      $jenkins_k8s"

echo ""
if [[ "$docker_status" == "✅ OK" && "$k8s_status" == "✅ OK" && "$registry_status" == "✅ OK" && "$jenkins_docker" == "✅ OK" && "$jenkins_k8s" == "✅ OK" ]]; then
    echo -e "${GREEN}🎉 Environment configuration is complete!${NC}"
    echo "You can now configure Jenkins credentials and run the blog deployment pipeline."
else
    echo -e "${YELLOW}⚠️  Some issues detected. Please review the output above.${NC}"
fi

echo ""
echo "📚 For more help, see:"
echo "   - JENKINS_ENVIRONMENT_SETUP.md"
echo "   - JENKINS_TROUBLESHOOTING.md"
echo "   - JENKINS_BLOG_DEPLOYMENT_SETUP.md"

pipeline {
    agent { label 'local-agent' }
    
    environment {
        // CoreDB credentials - the ONLY configuration database credentials needed
        // CoreDB stores all database connection configurations
        COREDB_ADMIN_USER = credentials('coredb-admin-user')
        COREDB_ADMIN_PASSWORD = credentials('coredb-admin-password')
        COREDB_ENCRYPTION_KEY = credentials('coredb-encryption-key')
        
        // PostgreSQL credentials for CoreDB and DataDB access
        POSTGRES_PASSWORD = credentials('postgres-password')
        
        // Application security credentials
        JWT_SECRET = credentials('jwt-secret')
        SESSION_SECRET = credentials('session-secret')

        // Image configuration
        BUILD_NUMBER = "${env.BUILD_NUMBER}"
        GIT_COMMIT_SHORT = ""
        FRONTEND_IMAGE = "localhost:5000/blog-frontend:${BUILD_NUMBER}"
        BACKEND_IMAGE = "localhost:5000/blog-backend:${BUILD_NUMBER}"

        // Environment configuration
        CORS_ORIGIN = 'https://blog.ingasti.com'
        VITE_API_URL = 'https://bapi.ingasti.com'

        // Docker registry
        REGISTRY_URL = 'localhost:5000'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    // Get short commit hash
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                    
                    // Update image tags with commit hash
                    env.FRONTEND_IMAGE = "${REGISTRY_URL}/blog-frontend:${BUILD_NUMBER}-${GIT_COMMIT_SHORT}"
                    env.BACKEND_IMAGE = "${REGISTRY_URL}/blog-backend:${BUILD_NUMBER}-${GIT_COMMIT_SHORT}"
                    
                    echo "� Building Blog Application"
                    echo "=============================="
                    echo "📦 Images to build:"
                    echo "  Frontend: ${env.FRONTEND_IMAGE}"
                    echo "  Backend: ${env.BACKEND_IMAGE}"
                    echo "🌐 Target URLs:"
                    echo "  Frontend: https://blog.ingasti.com"
                    echo "  Backend: https://bapi.ingasti.com"
                }
            }
        }
        
        stage('Build Backend Image') {
            steps {
                script {
                    echo "🔨 Building backend Docker image..."
                    dir('api') {
                        sh """
                            docker build -f Dockerfile.k8s -t ${env.BACKEND_IMAGE} .
                            docker tag ${env.BACKEND_IMAGE} ${REGISTRY_URL}/blog-backend:latest
                        """
                    }
                }
            }
        }
        
        stage('Build Frontend Image') {
            steps {
                script {
                    echo "🔨 Building frontend Docker image..."
                    dir('client') {
                        sh """
                            docker build -f Dockerfile.k8s -t ${env.FRONTEND_IMAGE} .
                            docker tag ${env.FRONTEND_IMAGE} ${REGISTRY_URL}/blog-frontend:latest
                        """
                    }
                }
            }
        }
        
        stage('Push Images to Registry') {
            steps {
                script {
                    echo "📤 Pushing images to registry..."
                    sh """
                        echo "Pushing backend image..."
                        docker push ${env.BACKEND_IMAGE}
                        docker push ${REGISTRY_URL}/blog-backend:latest
                        
                        echo "Pushing frontend image..."
                        docker push ${env.FRONTEND_IMAGE}
                        docker push ${REGISTRY_URL}/blog-frontend:latest
                    """
                }
            }
        }
        
        stage('Test Backend Container') {
            steps {
                script {
                    echo "🧪 Testing backend container..."
                    sh """
                        # Start backend container for testing with CoreDB credentials only
                        docker run -d -p 5001:5000 --name test-backend-${BUILD_NUMBER} \
                            -e COREDB_ADMIN_USER="${COREDB_ADMIN_USER}" \
                            -e COREDB_ADMIN_PASSWORD="${COREDB_ADMIN_PASSWORD}" \
                            -e COREDB_ENCRYPTION_KEY="${COREDB_ENCRYPTION_KEY}" \
                            -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
                            -e JWT_SECRET="${JWT_SECRET}" \
                            -e SESSION_SECRET="${SESSION_SECRET}" \
                            -e CORS_ORIGIN="${CORS_ORIGIN}" \
                            -e NODE_ENV=production \
                            ${env.BACKEND_IMAGE}
                        
                        # Wait for container to start
                        sleep 15
                        
                        # Test health endpoint
                        curl -f http://localhost:5001/health || (echo "Backend health check failed" && exit 1)
                        
                        echo "✅ Backend container test passed"
                    """
                }
            }
            post {
                always {
                    script {
                        // Cleanup test container
                        sh """
                            docker stop test-backend-${BUILD_NUMBER} || true
                            docker rm test-backend-${BUILD_NUMBER} || true
                        """
                    }
                }
            }
        }
        
        stage('Test Frontend Container') {
            steps {
                script {
                    echo "🧪 Testing frontend container..."
                    sh """
                        # Start frontend container for testing
                        docker run -d -p 3001:80 --name test-frontend-${BUILD_NUMBER} \
                            -e VITE_API_URL="${VITE_API_URL}" \
                            ${env.FRONTEND_IMAGE}
                        
                        # Wait for container to start
                        sleep 15
                        
                        # Test health endpoint
                        curl -f http://localhost:3001/health || (echo "Frontend health check failed" && exit 1)
                        
                        echo "✅ Frontend container test passed"
                    """
                }
            }
            post {
                always {
                    script {
                        // Cleanup test container
                        sh """
                            docker stop test-frontend-${BUILD_NUMBER} || true
                            docker rm test-frontend-${BUILD_NUMBER} || true
                        """
                    }
                }
            }
        }
        
        stage('Verify Kubernetes Access') {
            steps {
                script {
                    echo "🔍 Verifying Kubernetes cluster access..."
                    sh """
                        kubectl version --client
                        kubectl cluster-info --request-timeout=10s
                        kubectl get nodes
                    """
                    echo "✅ Kubernetes cluster is accessible"
                }
            }
        }
        
        stage('Deploy to Kubernetes') {
            steps {
                script {
                    echo "🚀 Deploying blog to Kubernetes..."
                    
                    // Update deployment files with current image tags
                    sh """
                        cd k8s
                        
                        # Backup original files
                        cp frontend-deployment.yaml frontend-deployment.yaml.bak
                        cp backend-deployment.yaml backend-deployment.yaml.bak
                        
                        # Update image tags in deployment files
                        sed -i 's|image: localhost:5000/blog-frontend:.*|image: ${env.FRONTEND_IMAGE}|g' frontend-deployment.yaml
                        sed -i 's|image: localhost:5000/blog-backend:.*|image: ${env.BACKEND_IMAGE}|g' backend-deployment.yaml
                        
                        # Apply all Kubernetes resources in the correct order
                        echo "📋 Applying namespace..."
                        kubectl apply -f namespace.yaml
                        
                        echo "🔐 Applying service account and RBAC..."
                        kubectl apply -f service-account.yaml
                        
                        echo "🗝️ Applying OIDC discovery service..."
                        kubectl apply -f oidc-configmap.yaml
                        kubectl apply -f oidc-discovery-service.yaml
                        
                        echo "🚀 Applying main application deployments..."
                        kubectl apply -f backend-deployment.yaml
                        kubectl apply -f frontend-deployment.yaml
                        
                        echo "🌐 Applying services and ingress..."
                        kubectl apply -f backend-service.yaml
                        kubectl apply -f frontend-service.yaml
                        kubectl apply -f ingress.yaml
                        
                        # Wait for deployments to be ready
                        echo "⏳ Waiting for deployments to be ready..."
                        kubectl wait --for=condition=available --timeout=300s deployment/blog-backend -n blog
                        kubectl wait --for=condition=available --timeout=300s deployment/blog-frontend -n blog
                        kubectl wait --for=condition=available --timeout=300s deployment/secure-oidc-discovery -n kube-system
                        
                        # Restore original deployment files
                        mv frontend-deployment.yaml.bak frontend-deployment.yaml
                        mv backend-deployment.yaml.bak backend-deployment.yaml
                    """
                    
                    echo "✅ Kubernetes deployment completed"
                }
            }
        }
        
        stage('Verify Deployment') {
            steps {
                script {
                    echo "🔍 Verifying blog deployment..."
                    sh """
                        # Check deployment status
                        kubectl get all -n blog
                        
                        # Check pod status
                        kubectl get pods -n blog -o wide
                        
                        # Check for any issues
                        kubectl describe pods -n blog -l app=blog-backend | grep -A 10 Events || true
                        kubectl describe pods -n blog -l app=blog-frontend | grep -A 10 Events || true
                        
                        # Internal health checks
                        echo "🏥 Performing internal health checks..."
                        kubectl run health-check-backend --image=busybox --rm -i --restart=Never --timeout=60s -- /bin/sh -c "wget -qO- http://blog-backend-service.blog.svc.cluster.local/health && echo 'Backend health check passed'" || echo "Backend health check failed"
                        
                        kubectl run health-check-frontend --image=busybox --rm -i --restart=Never --timeout=60s -- /bin/sh -c "wget -qO- http://blog-frontend-service.blog.svc.cluster.local/health && echo 'Frontend health check passed'" || echo "Frontend health check failed"
                    """
                }
            }
        }
        
        stage('Show Recent Logs') {
            steps {
                script {
                    echo "📋 Recent application logs:"
                    sh """
                        echo "Backend logs:"
                        kubectl logs -n blog -l app=blog-backend --tail=20 || echo "Could not fetch backend logs"
                        
                        echo "Frontend logs:"
                        kubectl logs -n blog -l app=blog-frontend --tail=20 || echo "Could not fetch frontend logs"
                    """
                }
            }
        }
    }
    
    post {
        always {
            script {
                // Cleanup old Docker images to save space
                sh """
                    echo "🧹 Cleaning up old Docker images..."
                    # Keep only the latest 5 images for each service
                    docker images ${REGISTRY_URL}/blog-backend --format "table {{.Tag}}\t{{.ID}}" | tail -n +2 | grep -v latest | awk '{print \$2}' | tail -n +6 | xargs -r docker rmi || true
                    docker images ${REGISTRY_URL}/blog-frontend --format "table {{.Tag}}\t{{.ID}}" | tail -n +2 | grep -v latest | awk '{print \$2}' | tail -n +6 | xargs -r docker rmi || true
                """
            }
        }
        success {
            echo "🎉 Blog deployment pipeline completed successfully!"
            echo ""
            echo "📱 Blog services should be available at:"
            echo "  Frontend: https://blog.ingasti.com"
            echo "  Backend: https://bapi.ingasti.com"
            echo ""
            echo "🔍 Monitor with:"
            echo "  kubectl get pods -n blog -w"
            echo "  kubectl logs -f deployment/blog-backend -n blog"
            echo "  kubectl logs -f deployment/blog-frontend -n blog"
            
            script {
                // Show final status
                sh """
                    echo "🌐 Service and Ingress Status:"
                    kubectl get services -n blog
                    kubectl get ingress -n blog
                """
            }
        }
        failure {
            echo "❌ Blog deployment pipeline failed!"
            echo ""
            echo "🔍 Debug information:"
            script {
                sh """
                    echo "Kubernetes cluster status:"
                    kubectl get nodes || true
                    kubectl get pods -n blog || true
                    kubectl get events -n blog --sort-by=.metadata.creationTimestamp | tail -10 || true
                """
            }
        }
    }
}

#!/bin/bash
# setup-nginx-ssl.sh
# Script to configure host Nginx for HTTPS proxy to blog containers

set -e

echo "🔧 Setting up Nginx SSL proxy configuration for blog containers..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Check if certificates exist
if [ ! -f "/etc/letsencrypt/live/ingasti.com/fullchain.pem" ]; then
    echo "❌ SSL certificates not found at /etc/letsencrypt/live/ingasti.com/"
    echo "Please ensure Let's Encrypt certificates are properly installed"
    exit 1
fi

echo "✅ SSL certificates found"

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx is not installed. Installing..."
    apt update
    apt install -y nginx
fi

echo "✅ Nginx is installed"

# Backup existing nginx configuration
echo "📁 Backing up existing Nginx configuration..."
cp -r /etc/nginx /etc/nginx.backup.$(date +%Y%m%d_%H%M%S) || true

# Copy frontend proxy configuration
echo "📝 Setting up frontend proxy (blog.ingasti.com)..."
cat > /etc/nginx/sites-available/blog.ingasti.com << 'EOF'
server {
    listen 80;
    server_name blog.ingasti.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name blog.ingasti.com;

    # SSL certificate configuration
    ssl_certificate /etc/letsencrypt/live/ingasti.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ingasti.com/privkey.pem;
    
    # SSL configuration for security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES256-SHA256:DHE-RSA-AES128-SHA:DHE-RSA-AES256-SHA;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Proxy to frontend container
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Enhanced security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
EOF

# Copy backend proxy configuration
echo "📝 Setting up backend proxy (bapi.ingasti.com)..."
cat > /etc/nginx/sites-available/bapi.ingasti.com << 'EOF'
server {
    listen 80;
    server_name bapi.ingasti.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bapi.ingasti.com;

    # SSL certificate configuration
    ssl_certificate /etc/letsencrypt/live/ingasti.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ingasti.com/privkey.pem;
    
    # SSL configuration for security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES256-SHA256:DHE-RSA-AES128-SHA:DHE-RSA-AES256-SHA;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Proxy to backend container
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers for API
        add_header Access-Control-Allow-Origin "https://blog.ingasti.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization" always;
        add_header Access-Control-Allow-Credentials "true" always;
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # Enhanced security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
EOF

# Enable sites
echo "🔗 Enabling sites..."
ln -sf /etc/nginx/sites-available/blog.ingasti.com /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/bapi.ingasti.com /etc/nginx/sites-enabled/

# Remove default site if it exists
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
echo "🧪 Testing Nginx configuration..."
if nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration test failed"
    exit 1
fi

# Reload nginx
echo "🔄 Reloading Nginx..."
systemctl reload nginx

echo ""
echo "✅ Nginx SSL proxy setup completed successfully!"
echo ""
echo "📋 Configuration Summary:"
echo "   - Frontend: https://blog.ingasti.com → http://localhost:3000"
echo "   - Backend:  https://bapi.ingasti.com → http://localhost:5000"
echo ""
echo "🔍 Next Steps:"
echo "   1. Ensure DNS records point blog.ingasti.com and bapi.ingasti.com to this server"
echo "   2. Run your Jenkins pipeline to deploy the blog containers"
echo "   3. Test the setup with: curl -I https://blog.ingasti.com"
echo ""
echo "📝 To check status: sudo systemctl status nginx"
echo "📋 To view logs: sudo tail -f /var/log/nginx/error.log"

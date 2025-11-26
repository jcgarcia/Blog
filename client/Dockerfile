# client/Dockerfile - Ultra-optimized production build
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod || \
    (echo "Lockfile version mismatch, regenerating..." && pnpm install --force --prod)

# Copy source and build
COPY . .
RUN pnpm build && \
    # Remove source maps and other development files from dist
    find dist -name "*.map" -delete && \
    # Remove unnecessary files
    rm -rf \
    node_modules \
    src \
    public/*.md \
    *.md \
    .git*

# Production stage - ultra minimal nginx
FROM nginx:alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

# Copy built app and nginx config
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# Create directories for SSL certificates with proper permissions
RUN mkdir -p /etc/ssl/certs /etc/ssl/private && \
    chown -R nginx:nginx /etc/ssl && \
    # Remove default nginx files
    rm -rf /etc/nginx/conf.d/default.conf

# Create non-root user for nginx
RUN addgroup -g 1001 -S nginxuser && \
    adduser -S nginxuser -u 1001 -G nginxuser

# Expose ports
EXPOSE 80 443

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["nginx", "-g", "daemon off;"]
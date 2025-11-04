# api/Dockerfile - Ultra-optimized production build
# Build stage - compile native dependencies
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies for native modules (argon2, sharp, etc.)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && corepack enable \
    && corepack prepare pnpm@9.12.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for building)
RUN pnpm install --frozen-lockfile || \
    (echo "Lockfile version mismatch, regenerating..." && pnpm install --force)

# Copy source code
COPY . .

# Remove development files
RUN rm -rf \
    .git* \
    *.md \
    .env.example \
    docs/ \
    tests/ \
    *.log

# Production stage - minimal runtime
FROM node:20-alpine AS production
WORKDIR /app

# Install only essential runtime packages
RUN apk add --no-cache \
    curl \
    dumb-init \
    && corepack enable \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Copy built application from builder stage
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./
COPY --from=builder --chown=appuser:nodejs /app/*.js ./
COPY --from=builder --chown=appuser:nodejs /app/controllers ./controllers
COPY --from=builder --chown=appuser:nodejs /app/middleware ./middleware
COPY --from=builder --chown=appuser:nodejs /app/routes ./routes
COPY --from=builder --chown=appuser:nodejs /app/config ./config
COPY --from=builder --chown=appuser:nodejs /app/utils ./utils
COPY --from=builder --chown=appuser:nodejs /app/services ./services

# Create necessary directories
RUN mkdir -p uploads && chown appuser:nodejs uploads

# Switch to non-root user
USER appuser

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["pnpm", "start"]
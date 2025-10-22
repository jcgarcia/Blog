FROM node:20-alpine

# Create app directory
WORKDIR /app

# Create data directory for persistent storage
RUN mkdir -p /app/data

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S coredb -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R coredb:nodejs /app

# Switch to non-root user
USER coredb

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the service
CMD ["node", "src/index.js"]
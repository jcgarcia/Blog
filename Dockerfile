# Bedtime Blog Dockerfile (multi-stage for production)

# --- Build Frontend ---
FROM node:18 AS frontend-build
WORKDIR /app
COPY client ./client
WORKDIR /app/client
RUN npm install -g pnpm && pnpm install && pnpm build

# --- Build Backend ---
FROM node:18 AS backend-build
WORKDIR /app
COPY api ./api
WORKDIR /app/api
RUN npm install -g pnpm && pnpm install

# --- Production Image ---
FROM node:18-slim
WORKDIR /app
# Copy backend
COPY --from=backend-build /app/api ./api
# Copy frontend build
COPY --from=frontend-build /app/client/dist ./client/dist
# Install pm2 for process management and postgresql-client for database backups
RUN npm install -g pm2 && \
    apk update && \
    apk add --no-cache postgresql-client

# Set environment variables (override in production)
ENV NODE_ENV=production
ENV PORT=8800

# Expose ports
EXPOSE 8800 5173

# Start backend and serve frontend static files
CMD ["pm2-runtime", "api/index.js"]

FROM postgres:16-alpine

# Install additional tools for backup management, monitoring, and SSL
RUN apk add --no-cache \
    curl \
    aws-cli \
    postgresql-client \
    bash \
    jq \
    openssl

# Create backup and SSL directories
RUN mkdir -p /var/lib/postgresql/backups /var/lib/postgresql/ssl && \
    chown -R postgres:postgres /var/lib/postgresql/backups /var/lib/postgresql/ssl

# Copy initialization, backup, and SSL configuration scripts
COPY scripts/init-database.sh /docker-entrypoint-initdb.d/01-init-database.sh
COPY scripts/setup-ssl.sh /docker-entrypoint-initdb.d/99-setup-ssl.sh
COPY scripts/configure-ssl-startup.sh /usr/local/bin/configure-ssl-startup.sh
COPY scripts/custom-entrypoint.sh /usr/local/bin/custom-entrypoint.sh
COPY scripts/restore-backup.sh /usr/local/bin/restore-backup.sh
COPY scripts/create-backup.sh /usr/local/bin/create-backup.sh
COPY scripts/health-check.sh /usr/local/bin/health-check.sh

# Make scripts executable
RUN chmod +x /docker-entrypoint-initdb.d/01-init-database.sh && \
    chmod +x /docker-entrypoint-initdb.d/99-setup-ssl.sh && \
    chmod +x /usr/local/bin/configure-ssl-startup.sh && \
    chmod +x /usr/local/bin/custom-entrypoint.sh && \
    chmod +x /usr/local/bin/restore-backup.sh && \
    chmod +x /usr/local/bin/create-backup.sh && \
    chmod +x /usr/local/bin/health-check.sh

# Set up volumes for data and backups
VOLUME ["/var/lib/postgresql/data", "/var/lib/postgresql/backups"]

# Health check using custom script
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD /usr/local/bin/health-check.sh

# Expose PostgreSQL port
EXPOSE 5432

# Use custom entrypoint that configures SSL before starting PostgreSQL
ENTRYPOINT ["/usr/local/bin/custom-entrypoint.sh"]
CMD ["postgres"]
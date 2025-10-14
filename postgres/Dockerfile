FROM postgres:16-alpine

# Install additional tools for backup management and monitoring
RUN apk add --no-cache \
    curl \
    aws-cli \
    postgresql-client \
    bash \
    jq

# Create backup directory
RUN mkdir -p /var/lib/postgresql/backups && \
    chown postgres:postgres /var/lib/postgresql/backups

# Copy initialization and backup scripts
COPY scripts/init-database.sh /docker-entrypoint-initdb.d/01-init-database.sh
COPY scripts/restore-backup.sh /usr/local/bin/restore-backup.sh
COPY scripts/create-backup.sh /usr/local/bin/create-backup.sh
COPY scripts/health-check.sh /usr/local/bin/health-check.sh

# Make scripts executable
RUN chmod +x /docker-entrypoint-initdb.d/01-init-database.sh && \
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

# Use official postgres entrypoint
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["postgres"]
# Blog Database Schema Documentation

## Overview

This document describes the complete database schema for the Blog application using PostgreSQL. The schema is designed to support a modern blog system with user management, content organization, media handling, and configuration management.

## Database Structure

### Core Tables

#### 1. `users` - User Management
Stores user account information and authentication data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique user identifier |
| `username` | VARCHAR(50) | NOT NULL, UNIQUE | User's login name |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | User's email address |
| `password_hash` | VARCHAR(255) | NOT NULL | Argon2 password hash |
| `first_name` | VARCHAR(100) | | User's first name |
| `last_name` | VARCHAR(100) | | User's last name |
| `bio` | TEXT | | User biography |
| `avatar_url` | VARCHAR(500) | | Profile picture URL |
| `role` | VARCHAR(20) | DEFAULT 'user' | User role (admin, editor, author, user) |
| `is_active` | BOOLEAN | DEFAULT TRUE | Account status |
| `email_verified` | BOOLEAN | DEFAULT FALSE | Email verification status |
| `last_login_at` | TIMESTAMP | | Last login timestamp |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Account creation date |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_users_username` on `username`
- `idx_users_email` on `email`
- `idx_users_role` on `role`

#### 2. `categories` - Content Organization
Hierarchical categories for organizing blog posts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique category identifier |
| `name` | VARCHAR(100) | NOT NULL, UNIQUE | Category display name |
| `slug` | VARCHAR(100) | NOT NULL, UNIQUE | URL-friendly identifier |
| `description` | TEXT | | Category description |
| `color` | VARCHAR(7) | | Hex color code for UI |
| `icon` | VARCHAR(50) | | Icon name or CSS class |
| `parent_id` | INTEGER | REFERENCES categories(id) | Parent category for hierarchy |
| `sort_order` | INTEGER | DEFAULT 0 | Display order |
| `is_active` | BOOLEAN | DEFAULT TRUE | Category status |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation date |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update |

**Indexes:**
- `idx_categories_slug` on `slug`
- `idx_categories_parent_id` on `parent_id`

#### 3. `tags` - Content Tagging
Tags for flexible content labeling.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique tag identifier |
| `name` | VARCHAR(50) | NOT NULL, UNIQUE | Tag name |
| `slug` | VARCHAR(50) | NOT NULL, UNIQUE | URL-friendly identifier |
| `description` | TEXT | | Tag description |
| `color` | VARCHAR(7) | | Hex color code |
| `usage_count` | INTEGER | DEFAULT 0 | Number of times used |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation date |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update |

**Indexes:**
- `idx_tags_slug` on `slug`

#### 4. `posts` - Blog Content
Main content storage for blog posts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique post identifier |
| `title` | VARCHAR(255) | NOT NULL | Post title |
| `slug` | VARCHAR(255) | NOT NULL, UNIQUE | URL-friendly identifier |
| `excerpt` | TEXT | | Post summary |
| `content` | TEXT | NOT NULL | Raw content (Markdown) |
| `content_html` | TEXT | | Rendered HTML content |
| `featured_image` | VARCHAR(500) | | Featured image URL |
| `meta_title` | VARCHAR(255) | | SEO title |
| `meta_description` | TEXT | | SEO description |
| `author_id` | INTEGER | NOT NULL, REFERENCES users(id) | Post author |
| `category_id` | INTEGER | REFERENCES categories(id) | Post category |
| `status` | VARCHAR(20) | DEFAULT 'draft' | Post status (draft, published, scheduled, archived) |
| `visibility` | VARCHAR(20) | DEFAULT 'public' | Visibility (public, private, protected) |
| `password` | VARCHAR(255) | | Password for protected posts |
| `published_at` | TIMESTAMP | | Publication date |
| `scheduled_at` | TIMESTAMP | | Scheduled publication date |
| `reading_time` | INTEGER | | Estimated reading time (minutes) |
| `view_count` | INTEGER | DEFAULT 0 | Number of views |
| `like_count` | INTEGER | DEFAULT 0 | Number of likes |
| `comment_count` | INTEGER | DEFAULT 0 | Number of comments |
| `is_featured` | BOOLEAN | DEFAULT FALSE | Featured post flag |
| `allow_comments` | BOOLEAN | DEFAULT TRUE | Allow comments flag |
| `seo_score` | INTEGER | | SEO optimization score |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation date |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update |

**Indexes:**
- `idx_posts_author_id` on `author_id`
- `idx_posts_category_id` on `category_id`
- `idx_posts_status` on `status`
- `idx_posts_published_at` on `published_at`
- `idx_posts_slug` on `slug`
- `idx_posts_featured` on `is_featured`

#### 5. `post_tags` - Post-Tag Relationships
Many-to-many relationship between posts and tags.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique relationship identifier |
| `post_id` | INTEGER | NOT NULL, REFERENCES posts(id) ON DELETE CASCADE | Post reference |
| `tag_id` | INTEGER | NOT NULL, REFERENCES tags(id) ON DELETE CASCADE | Tag reference |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation date |

**Constraints:**
- `UNIQUE(post_id, tag_id)` - Prevent duplicate relationships

**Indexes:**
- `idx_post_tags_post_id` on `post_id`
- `idx_post_tags_tag_id` on `tag_id`

#### 6. `comments` - User Comments
Comment system for blog posts with threading support.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique comment identifier |
| `post_id` | INTEGER | NOT NULL, REFERENCES posts(id) ON DELETE CASCADE | Associated post |
| `parent_id` | INTEGER | REFERENCES comments(id) | Parent comment for threading |
| `author_name` | VARCHAR(100) | NOT NULL | Commenter name |
| `author_email` | VARCHAR(255) | NOT NULL | Commenter email |
| `author_url` | VARCHAR(500) | | Commenter website |
| `author_ip` | INET | | Commenter IP address |
| `content` | TEXT | NOT NULL | Comment content |
| `status` | VARCHAR(20) | DEFAULT 'pending' | Status (pending, approved, spam, trash) |
| `user_agent` | TEXT | | Browser user agent |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation date |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update |

**Indexes:**
- `idx_comments_post_id` on `post_id`
- `idx_comments_status` on `status`
- `idx_comments_parent_id` on `parent_id`

#### 7. `media` - File Management
Media file storage and metadata.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique media identifier |
| `filename` | VARCHAR(255) | NOT NULL | Stored filename |
| `original_filename` | VARCHAR(255) | NOT NULL | Original upload filename |
| `mime_type` | VARCHAR(100) | NOT NULL | File MIME type |
| `file_size` | INTEGER | NOT NULL | File size in bytes |
| `file_path` | VARCHAR(500) | NOT NULL | Storage path |
| `folder_path` | VARCHAR(255) | DEFAULT '/' | Organization folder |
| `alt_text` | VARCHAR(255) | | Alternative text for accessibility |
| `caption` | TEXT | | Media caption |
| `description` | TEXT | | Media description |
| `width` | INTEGER | | Image width (pixels) |
| `height` | INTEGER | | Image height (pixels) |
| `uploaded_by` | INTEGER | REFERENCES users(id) | Upload user |
| `post_id` | INTEGER | REFERENCES posts(id) | Associated post (optional) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Upload date |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update |

**Indexes:**
- `idx_media_post_id` on `post_id`
- `idx_media_uploaded_by` on `uploaded_by`

#### 8. `media_folders` - Media Organization
Hierarchical folder structure for media organization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique folder identifier |
| `name` | VARCHAR(255) | NOT NULL | Folder display name |
| `path` | VARCHAR(255) | NOT NULL, UNIQUE | Full folder path |
| `parent_id` | INTEGER | REFERENCES media_folders(id) ON DELETE CASCADE | Parent folder |
| `created_by` | INTEGER | REFERENCES users(id) ON DELETE SET NULL | Creator user |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation date |

#### 9. `settings` - System Configuration
Application-wide configuration settings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique setting identifier |
| `key` | VARCHAR(255) | NOT NULL, UNIQUE | Setting key identifier |
| `value` | TEXT | | Setting value |
| `type` | VARCHAR(50) | DEFAULT 'string' | Value type (string, number, boolean, json) |
| `group_name` | VARCHAR(100) | DEFAULT 'general' | Setting group for organization |
| `description` | TEXT | | Setting description |
| `is_public` | BOOLEAN | DEFAULT FALSE | Public API accessibility |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation date |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update |

**Setting Groups:**
- `general` - Basic site settings
- `blog` - Blog-specific settings
- `social` - Social media links
- `media` - Media storage configuration
- `oauth` - OAuth provider settings
- `aws` - AWS integration settings
- `notifications` - Email and notification settings
- `analytics` - Analytics and tracking settings
- `system` - System-level settings

#### 10. `sessions` - User Sessions
User session management for authentication.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(255) | PRIMARY KEY | Session identifier |
| `user_id` | INTEGER | REFERENCES users(id) ON DELETE CASCADE | Associated user |
| `ip_address` | INET | | Client IP address |
| `user_agent` | TEXT | | Client user agent |
| `payload` | TEXT | NOT NULL | Session data |
| `last_activity` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last activity |
| `expires_at` | TIMESTAMP | NOT NULL | Expiration time |

**Indexes:**
- `idx_sessions_user_id` on `user_id`
- `idx_sessions_expires_at` on `expires_at`

#### 11. `analytics` - Usage Analytics
Event tracking for analytics and insights.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique event identifier |
| `post_id` | INTEGER | REFERENCES posts(id) ON DELETE CASCADE | Associated post |
| `event_type` | VARCHAR(50) | NOT NULL | Event type (view, like, share, comment) |
| `ip_address` | INET | | Client IP address |
| `user_agent` | TEXT | | Client user agent |
| `referrer` | VARCHAR(500) | | Referrer URL |
| `user_id` | INTEGER | REFERENCES users(id) | Associated user (if logged in) |
| `metadata` | JSONB | | Additional event data |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Event timestamp |

**Indexes:**
- `idx_analytics_post_id` on `post_id`
- `idx_analytics_event_type` on `event_type`
- `idx_analytics_created_at` on `created_at`

#### 12. `subscribers` - Newsletter Subscriptions
Email subscription management.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique subscriber identifier |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | Subscriber email |
| `name` | VARCHAR(100) | | Subscriber name |
| `status` | VARCHAR(20) | DEFAULT 'pending' | Status (pending, active, unsubscribed) |
| `verification_token` | VARCHAR(255) | | Email verification token |
| `subscribed_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Subscription date |
| `unsubscribed_at` | TIMESTAMP | | Unsubscription date |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Creation date |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Last update |

#### 13. `migration_history` - Migration Tracking
Tracks applied database migrations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique migration identifier |
| `migration_name` | VARCHAR(255) | NOT NULL, UNIQUE | Migration filename |
| `applied_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Application timestamp |
| `description` | TEXT | | Migration description |

## Database Functions and Triggers

### Update Timestamp Function
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Automatic Timestamp Updates
Triggers are created for all tables with `updated_at` columns to automatically update the timestamp when records are modified.

## Default Data

### Categories
- Technology (slug: technology)
- Lifestyle (slug: lifestyle)
- Tutorial (slug: tutorial)
- News (slug: news)
- Review (slug: review)

### Tags
- JavaScript, Python, Web Development
- AI, Machine Learning, DevOps
- Tutorial, Beginner, Advanced, Open Source

### Settings
- `site_title` - Website title
- `site_description` - Website description
- `site_url` - Website URL
- `posts_per_page` - Pagination setting
- `allow_comments` - Comment system toggle
- `media_storage_type` - Storage configuration
- Social media URL settings

### Media Folders
- `/` (Root)
- `/images` (Images)
- `/documents` (Documents)
- `/videos` (Videos)

## Migration System

### Migration Files
Migration files are stored in `database/migrations/` and follow the naming convention:
```
{number}_{description}.sql
```

Example: `001_fix_settings_schema.sql`

### Migration Runner
The `run-migrations.sh` script:
1. Checks database connectivity
2. Creates `migration_history` table if needed
3. Runs migrations in order
4. Tracks applied migrations
5. Provides detailed logging

### CI/CD Integration
Database migrations are automatically run during deployment via the Jenkins pipeline before application containers are tested and deployed.

## Environment Variables

Required for database connection:
- `PGHOST` - Database host
- `PGPORT` - Database port (default: 5432)
- `PGDATABASE` - Database name
- `PGUSER` - Database username
- `PGPASSWORD` - Database password
- `PGSSLMODE` - SSL mode (require for production)

## Security Considerations

1. **Password Hashing**: User passwords are stored as Argon2 hashes
2. **SQL Injection Prevention**: All queries use parameterized statements
3. **Session Management**: Secure session storage with expiration
4. **Role-Based Access**: User roles control access to different features
5. **API Key Storage**: Encrypted storage of sensitive configuration
6. **Audit Logging**: Configuration changes are tracked
7. **IP Tracking**: Client IP addresses logged for security monitoring

## Performance Optimizations

1. **Indexes**: Strategic indexes on frequently queried columns
2. **Pagination**: Efficient pagination for large datasets
3. **Connection Pooling**: Database connection pooling in application
4. **Query Optimization**: Optimized queries with proper joins
5. **Caching Strategy**: Application-level caching for settings and static data

## Backup and Recovery

1. **Regular Backups**: Automated daily backups
2. **Point-in-Time Recovery**: WAL archiving for PITR
3. **Migration Rollback**: Reversible migrations where possible
4. **Data Integrity**: Foreign key constraints maintain referential integrity

## Monitoring and Maintenance

1. **Migration History**: Track all schema changes
2. **Performance Monitoring**: Query performance tracking
3. **Storage Monitoring**: Database size and growth monitoring
4. **Connection Monitoring**: Active connection tracking
5. **Error Logging**: Comprehensive error logging and alerting
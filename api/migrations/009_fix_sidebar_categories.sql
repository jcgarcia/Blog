-- Migration: Fix sidebar categories display issues
-- Purpose: Hide Jumble category from sidebar and remove duplicate "All Posts" category
-- Date: 2025-10-11
-- Context: Sidebar showing Jumble and duplicate "All Posts" categories

BEGIN;

-- Hide Jumble category from sidebar (it should not be visible to users)
UPDATE categories 
SET show_in_sidebar = false, 
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'jumble' OR name = 'Jumble' OR id = 0;

-- Remove any duplicate "All Posts" category entries 
-- (The "All Posts" should only appear as a hardcoded item at the top of the sidebar)
DELETE FROM categories WHERE name = 'All Posts' OR slug = 'all-posts';

-- Ensure the database has a proper Jumble category as ID 0 for fallback
INSERT INTO categories (id, name, slug, description, color, sort_order, is_active, show_in_sidebar, created_at, updated_at)
VALUES (0, 'Jumble', 'jumble', 'Default category for uncategorized posts', '#6B7280', 0, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET 
    name = 'Jumble',
    slug = 'jumble',
    description = 'Default category for uncategorized posts',
    show_in_sidebar = false,
    updated_at = CURRENT_TIMESTAMP;

COMMIT;
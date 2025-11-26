-- Migration: Fix thumbnail relationships and hide thumbnail files from main view
-- Purpose: Link thumbnails to their parent files and prevent thumbnails from showing as separate items
-- Date: 2025-10-10
-- Context: Thumbnails are showing as duplicate items instead of being linked to parent files

BEGIN;

-- Step 1: Update parent files to reference their thumbnails
UPDATE media 
SET thumbnail_key = (
    SELECT s3_key 
    FROM media thumb 
    WHERE thumb.filename = REPLACE(media.filename, '.pdf', '_thumb.png')
       OR thumb.filename = REPLACE(media.filename, '.jpg', '_thumb.jpg')
       OR thumb.filename = REPLACE(media.filename, '.png', '_thumb.png')
       OR thumb.filename = REPLACE(media.filename, '.jpeg', '_thumb.jpg')
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 
    FROM media thumb 
    WHERE thumb.filename LIKE '%_thumb.%' 
    AND (
        thumb.filename = REPLACE(media.filename, '.pdf', '_thumb.png')
        OR thumb.filename = REPLACE(media.filename, '.jpg', '_thumb.jpg')
        OR thumb.filename = REPLACE(media.filename, '.png', '_thumb.png')
        OR thumb.filename = REPLACE(media.filename, '.jpeg', '_thumb.jpg')
    )
)
AND media.filename NOT LIKE '%_thumb.%';

-- Step 2: Add a flag to hide thumbnail files from main library view
ALTER TABLE media ADD COLUMN IF NOT EXISTS is_thumbnail BOOLEAN DEFAULT FALSE;

-- Step 3: Mark all thumbnail files as thumbnails (so they don't show in main view)
UPDATE media 
SET is_thumbnail = TRUE 
WHERE filename LIKE '%_thumb.%' 
   OR filename LIKE '%thumb.%';

-- Step 4: Verify the changes
SELECT 'Parent files with thumbnails:' as message, COUNT(*) as count 
FROM media 
WHERE thumbnail_key IS NOT NULL AND is_thumbnail = FALSE;

SELECT 'Thumbnail files marked:' as message, COUNT(*) as count 
FROM media 
WHERE is_thumbnail = TRUE;

COMMIT;
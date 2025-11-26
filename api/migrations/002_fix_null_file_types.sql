-- Migration: Fix null file_type values causing JavaScript errors
-- Purpose: Populate missing file_type values based on mime_type to prevent frontend crashes
-- Date: 2025-10-10
-- Context: Frontend JavaScript crashes when file_type is null and .toUpperCase() is called

BEGIN;

-- Update file_type based on mime_type for all null/empty file_type records
UPDATE media 
SET file_type = CASE 
    WHEN mime_type LIKE 'image/%' THEN 'image'
    WHEN mime_type LIKE 'video/%' THEN 'video'
    WHEN mime_type LIKE 'audio/%' THEN 'audio'
    WHEN mime_type = 'application/pdf' THEN 'document'
    WHEN mime_type LIKE 'text/%' THEN 'document'
    WHEN mime_type LIKE 'application/%' THEN 'document'
    ELSE 'file'
END
WHERE file_type IS NULL OR file_type = '';

-- Verify the update worked
SELECT 'Fixed records:' as message, COUNT(*) as count 
FROM media 
WHERE file_type IS NOT NULL AND file_type != '';

COMMIT;
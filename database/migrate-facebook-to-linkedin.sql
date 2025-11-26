-- Migration script: Replace Facebook with LinkedIn in social media settings
-- Run this script to update existing databases

-- Step 1: Copy Facebook URL value to LinkedIn (if Facebook entry exists)
UPDATE settings 
SET key = 'social_linkedin_url', description = 'LinkedIn profile URL'
WHERE key = 'social_facebook_url';

-- Step 2: If there was no Facebook entry, create the LinkedIn entry
INSERT INTO settings (key, value, type, group_name, description, is_public) 
VALUES ('social_linkedin_url', '', 'string', 'social', 'LinkedIn profile URL', TRUE)
ON CONFLICT (key) DO NOTHING;

-- Display results
SELECT 'Migration completed: Facebook replaced with LinkedIn' AS status;
SELECT key, value, description FROM settings WHERE group_name = 'social' ORDER BY key;

-- Note: If you had a Facebook URL configured, it has been moved to the LinkedIn field.
-- You can update it in the ops panel to point to your actual LinkedIn profile.
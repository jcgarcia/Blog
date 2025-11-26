-- Add TinyMCE and editor configuration settings
-- This script should be run to add the new settings for the enhanced editor

INSERT INTO settings (key, value, type, group_name, description, is_public) VALUES
('tinymce_api_key', '', 'string', 'editor', 'TinyMCE Cloud API key for rich text editing', false),
('enable_auto_save', 'true', 'boolean', 'editor', 'Enable auto-save for post drafts', false),
('auto_save_interval', '30', 'number', 'editor', 'Auto-save interval in seconds', false),
('editor_theme', 'default', 'string', 'editor', 'Editor theme configuration', false),
('enable_spell_check', 'true', 'boolean', 'editor', 'Enable spell checking in editor', false),
('enable_word_count', 'true', 'boolean', 'editor', 'Show word count in editor', false)
ON CONFLICT (key) DO UPDATE SET
    description = EXCLUDED.description,
    group_name = EXCLUDED.group_name;

-- Update existing settings with better descriptions
UPDATE settings SET 
    description = 'Website title displayed in header and meta tags',
    is_public = true
WHERE key = 'site_title';

UPDATE settings SET 
    description = 'Website description for meta tags and SEO',
    is_public = true  
WHERE key = 'site_description';

-- Show the result
SELECT 'TinyMCE settings added successfully' as status;
SELECT key, value, type, group_name, description FROM settings WHERE group_name = 'editor' ORDER BY key;

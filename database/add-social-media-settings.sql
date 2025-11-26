-- Insert default social media settings into the settings table
INSERT INTO settings (key, value, type, group_name, description, is_public) VALUES
('social_linkedin_url', '', 'string', 'social', 'LinkedIn profile URL', TRUE),
('social_twitter_url', '', 'string', 'social', 'X (Twitter) profile URL', TRUE),
('social_instagram_url', '', 'string', 'social', 'Instagram profile URL', TRUE),
('social_threads_url', '', 'string', 'social', 'Threads profile URL', TRUE)
ON CONFLICT (key) DO NOTHING;

-- Display results
SELECT 'Social media settings created successfully' AS status;
SELECT key, value, description FROM settings WHERE group_name = 'social';

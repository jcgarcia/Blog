-- Restore Media Folders Structure 
-- This creates the basic folder structure needed for the media system to work

DO $$
BEGIN
    RAISE NOTICE 'Creating essential media folder structure...';
    
    -- Create root folder (ID 1)
    INSERT INTO media_folders (id, name, path, parent_id, description, created_at)
    VALUES (1, 'Root', '/', NULL, 'Root folder for all media', CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO NOTHING;
    
    -- Create images folder (ID 2) 
    INSERT INTO media_folders (id, name, path, parent_id, description, created_at)
    VALUES (2, 'Images', '/images', 1, 'Image files and photos', CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO NOTHING;
    
    -- Create documents folder (ID 3)
    INSERT INTO media_folders (id, name, path, parent_id, description, created_at)
    VALUES (3, 'Documents', '/documents', 1, 'PDF and document files', CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO NOTHING;
    
    -- Create thumbnails folder (ID 4)
    INSERT INTO media_folders (id, name, path, parent_id, description, created_at)
    VALUES (4, 'Thumbnails', '/thumbnails', 1, 'Auto-generated thumbnails', CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO NOTHING;
    
    -- Reset sequence to match highest ID
    PERFORM setval('media_folders_id_seq', 4, true);
    
    RAISE NOTICE '✓ Media folder structure created successfully';
    
END $$;
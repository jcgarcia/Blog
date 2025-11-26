-- Static Pages Table Schema for Blog CMS (PostgreSQL)
-- This table stores editable static content like About, Terms, Privacy pages

CREATE TABLE IF NOT EXISTS static_pages (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    meta_title VARCHAR(255),
    meta_description TEXT,
    content TEXT NOT NULL,
    excerpt TEXT,
    is_published BOOLEAN DEFAULT TRUE,
    show_in_menu BOOLEAN DEFAULT FALSE,
    menu_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_by INTEGER,
    CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_static_pages_slug ON static_pages(slug);
CREATE INDEX IF NOT EXISTS idx_static_pages_published ON static_pages(is_published);
CREATE INDEX IF NOT EXISTS idx_static_pages_menu ON static_pages(show_in_menu, menu_order);

-- Insert default static pages
INSERT INTO static_pages (slug, title, meta_title, meta_description, content, excerpt, show_in_menu, menu_order, created_by, updated_by)
VALUES 
(
    'about',
    'About Us',
    'About Bedtime Blog - Your Daily Dose of Inspiration',
    'Learn more about Bedtime Blog, our mission to provide inspiring content for your daily reflection and growth.',
    '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Welcome to Bedtime Blog","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"heading","version":1,"tag":"h1"},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"At Bedtime Blog, we believe in the power of reflection and inspiration. Our mission is to provide you with thoughtful content that helps you unwind, reflect, and prepare for peaceful rest.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Our Story","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"heading","version":1,"tag":"h2"},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Founded with a passion for meaningful content, Bedtime Blog serves as your companion for evening reflection and inspiration. We curate and create content that speaks to the heart and mind.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}',
    'Learn more about Bedtime Blog and our mission to provide inspiring content.',
    TRUE,
    1,
    1,
    1
),
(
    'terms-of-service',
    'Terms of Service',
    'Terms of Service - Bedtime Blog',
    'Read our terms of service and understand your rights and responsibilities when using Bedtime Blog.',
    '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Terms of Service","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"heading","version":1,"tag":"h1"},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Last updated: August 10, 2025","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"1. Acceptance of Terms","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"heading","version":1,"tag":"h2"},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}',
    'Our terms of service and user agreement.',
    TRUE,
    2,
    1,
    1
),
(
    'privacy-policy',
    'Privacy Policy',
    'Privacy Policy - Bedtime Blog',
    'Understand how we collect, use, and protect your personal information at Bedtime Blog.',
    '{"root":{"children":[{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Privacy Policy","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"heading","version":1,"tag":"h1"},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Last updated: August 10, 2025","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"Information We Collect","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"heading","version":1,"tag":"h2"},{"children":[{"detail":0,"format":0,"mode":"normal","style":"","text":"We are committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information.","type":"text","version":1}],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}',
    'How we protect and use your personal information.',
    TRUE,
    3,
    1,
    1
);

-- Trigger function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_static_pages_updated_at 
    BEFORE UPDATE ON static_pages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

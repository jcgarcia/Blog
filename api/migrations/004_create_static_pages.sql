-- Migration: Create static_pages table and populate with default pages
-- Purpose: Create missing static pages functionality
-- Date: 2025-10-10

BEGIN;

-- Create static_pages table
CREATE TABLE IF NOT EXISTS static_pages (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    meta_title VARCHAR(255),
    meta_description TEXT,
    content TEXT NOT NULL,
    excerpt TEXT,
    is_published BOOLEAN DEFAULT true,
    show_in_menu BOOLEAN DEFAULT true,
    menu_order INTEGER DEFAULT 0,
    created_by INTEGER,
    updated_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraints if users table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        ALTER TABLE static_pages ADD CONSTRAINT static_pages_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
        
        ALTER TABLE static_pages ADD CONSTRAINT static_pages_updated_by_fkey 
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END
$$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_static_pages_slug ON static_pages(slug);
CREATE INDEX IF NOT EXISTS idx_static_pages_published ON static_pages(is_published);
CREATE INDEX IF NOT EXISTS idx_static_pages_menu ON static_pages(show_in_menu, menu_order);

-- Insert default Privacy Policy page
INSERT INTO static_pages (slug, title, meta_title, meta_description, content, excerpt, is_published, show_in_menu, menu_order)
VALUES (
    'privacy',
    'Privacy Policy',
    'Privacy Policy - Bedtime Blog',
    'Privacy policy for Bedtime Blog - how we collect, use, and protect your information.',
    '{"root":{"type":"root","children":[{"type":"heading","tag":"h1","children":[{"type":"text","text":"Privacy Policy"}]},{"type":"paragraph","children":[{"type":"text","text":"Last updated: December 28, 2024"}]},{"type":"heading","tag":"h2","children":[{"type":"text","text":"1. Information We Collect"}]},{"type":"paragraph","children":[{"type":"text","text":"We collect information you provide directly to us, such as when you create an account, publish content, or contact us."}]},{"type":"heading","tag":"h3","children":[{"type":"text","text":"Personal Information:"}]},{"type":"list","listType":"bullet","children":[{"type":"listitem","children":[{"type":"text","text":"Name and email address"}]},{"type":"listitem","children":[{"type":"text","text":"Profile information and preferences"}]},{"type":"listitem","children":[{"type":"text","text":"Content you create or publish"}]}]},{"type":"heading","tag":"h2","children":[{"type":"text","text":"2. How We Use Your Information"}]},{"type":"paragraph","children":[{"type":"text","text":"We use the information we collect to:"}]},{"type":"list","listType":"bullet","children":[{"type":"listitem","children":[{"type":"text","text":"Provide and maintain our services"}]},{"type":"listitem","children":[{"type":"text","text":"Communicate with you about your account"}]},{"type":"listitem","children":[{"type":"text","text":"Improve our services and user experience"}]}]},{"type":"heading","tag":"h2","children":[{"type":"text","text":"3. Information Sharing"}]},{"type":"paragraph","children":[{"type":"text","text":"We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy."}]},{"type":"heading","tag":"h2","children":[{"type":"text","text":"4. Data Security"}]},{"type":"paragraph","children":[{"type":"text","text":"We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction."}]},{"type":"heading","tag":"h2","children":[{"type":"text","text":"5. Contact Us"}]},{"type":"paragraph","children":[{"type":"text","text":"If you have questions about this Privacy Policy, please contact us through our contact form."}]}]}}',
    'Our privacy policy explains how we collect, use, and protect your information.',
    true,
    true,
    1
) ON CONFLICT (slug) DO NOTHING;

-- Insert default Terms of Service page
INSERT INTO static_pages (slug, title, meta_title, meta_description, content, excerpt, is_published, show_in_menu, menu_order)
VALUES (
    'terms',
    'Terms of Service',
    'Terms of Service - Bedtime Blog',
    'Terms of service for Bedtime Blog - rules and guidelines for using our platform.',
    '{"root":{"type":"root","children":[{"type":"heading","tag":"h1","children":[{"type":"text","text":"Terms of Service"}]},{"type":"paragraph","children":[{"type":"text","text":"Last updated: December 28, 2024"}]},{"type":"heading","tag":"h2","children":[{"type":"text","text":"1. Acceptance of Terms"}]},{"type":"paragraph","children":[{"type":"text","text":"By accessing and using Bedtime Blog, you accept and agree to be bound by the terms and provision of this agreement."}]},{"type":"heading","tag":"h2","children":[{"type":"text","text":"2. User Accounts"}]},{"type":"paragraph","children":[{"type":"text","text":"You are responsible for maintaining the confidentiality of your account and password."}]},{"type":"heading","tag":"h2","children":[{"type":"text","text":"3. Content Guidelines"}]},{"type":"paragraph","children":[{"type":"text","text":"Users must not post content that is:"}]},{"type":"list","listType":"bullet","children":[{"type":"listitem","children":[{"type":"text","text":"Illegal or harmful"}]},{"type":"listitem","children":[{"type":"text","text":"Offensive or inappropriate"}]},{"type":"listitem","children":[{"type":"text","text":"Infringing on intellectual property rights"}]}]},{"type":"heading","tag":"h2","children":[{"type":"text","text":"4. Limitation of Liability"}]},{"type":"paragraph","children":[{"type":"text","text":"Bedtime Blog shall not be liable for any indirect, incidental, special, consequential, or punitive damages."}]},{"type":"heading","tag":"h2","children":[{"type":"text","text":"5. Changes to Terms"}]},{"type":"paragraph","children":[{"type":"text","text":"We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting."}]},{"type":"heading","tag":"h2","children":[{"type":"text","text":"6. Contact Information"}]},{"type":"paragraph","children":[{"type":"text","text":"For questions about these Terms of Service, please contact us through our contact form."}]}]}}',
    'Terms of service and usage guidelines for Bedtime Blog.',
    true,
    true,
    2
) ON CONFLICT (slug) DO NOTHING;

COMMIT;
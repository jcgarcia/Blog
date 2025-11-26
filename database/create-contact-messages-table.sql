-- Create contact_messages table for storing contact form submissions
CREATE TABLE IF NOT EXISTS contact_messages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    replied_at TIMESTAMP NULL,
    notes TEXT NULL
);

-- Create an index on created_at for better query performance
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);

-- Create an index on status for filtering
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);

-- Insert a test message to verify the table structure
INSERT INTO contact_messages (name, email, subject, message, status) VALUES 
('Test User', 'test@example.com', 'Test Contact Form', 'This is a test message to verify the contact form functionality.', 'test')
ON CONFLICT DO NOTHING;

-- Display the created table structure
\d contact_messages;

-- Show sample data
SELECT 'Contact messages table created successfully' AS status;
SELECT * FROM contact_messages WHERE status = 'test';

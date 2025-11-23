// Test script to create contact_messages table and fix contact form
import { getDbPool } from './api/db.js';

async function setupContactTable() {
  try {
    const pool = getDbPool();
    
    console.log('Creating contact_messages table if it doesn\'t exist...');
    
    // Create the table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        replied_at TIMESTAMP NULL,
        admin_notes TEXT NULL
      );
    `);
    
    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
    `);
    
    console.log('✅ Contact messages table created successfully');
    
    // Test inserting a message
    await pool.query(`
      INSERT INTO contact_messages (name, email, subject, message, status) 
      VALUES ('Test User', 'test@example.com', 'Test Contact Form', 'This is a test message to verify the contact form is working.', 'test')
      ON CONFLICT DO NOTHING;
    `);
    
    console.log('✅ Test message inserted successfully');
    
    // Check the table structure
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'contact_messages' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Contact messages table structure:');
    console.table(result.rows);
    
    // Check recent messages
    const messages = await pool.query(`
      SELECT id, name, email, subject, status, created_at 
      FROM contact_messages 
      ORDER BY created_at DESC 
      LIMIT 5;
    `);
    
    console.log('📨 Recent contact messages:');
    console.table(messages.rows);
    
  } catch (error) {
    console.error('❌ Error setting up contact table:', error);
  } finally {
    process.exit(0);
  }
}

setupContactTable();
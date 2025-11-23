// Test SMTP configuration and email sending
import { getDbPool } from "./api/db.js";
import nodemailer from "nodemailer";

const testEmailConfig = async () => {
  try {
    const pool = getDbPool();
    
    // Get SMTP settings from database
    const settingsResult = await pool.query(`
      SELECT key, value FROM settings 
      WHERE key IN ('smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_secure', 'contact_email', 'email_notifications')
    `);
    
    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    console.log('SMTP Settings:', settings);
    
    // Create transporter
    const transporter = nodemailer.createTransporter({
      host: settings.smtp_host,
      port: parseInt(settings.smtp_port) || 587,
      secure: settings.smtp_secure === 'true',
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_pass,
      },
    });
    
    // Test connection
    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    
    // Send test email
    const testEmail = {
      from: settings.smtp_from,
      to: settings.contact_email,
      subject: 'Contact Form Test Email',
      html: `
        <h3>Contact Form Test</h3>
        <p>This is a test email to verify SMTP configuration is working.</p>
        <p>Sent at: ${new Date().toLocaleString()}</p>
      `
    };
    
    console.log('Sending test email...');
    const result = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!', result.messageId);
    
  } catch (error) {
    console.error('❌ Email test failed:', error);
  }
};

testEmailConfig();
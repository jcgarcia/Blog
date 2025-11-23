// Direct SMTP test to debug the exact issue
import { getDbPool } from './api/db.js';
import nodemailer from 'nodemailer';

async function debugEmailIssue() {
  console.log('🔍 Starting email debug...');
  
  try {
    const pool = getDbPool();
    console.log('✅ Database connection obtained');

    // Get SMTP settings from database (exact same query as contact controller)
    console.log('📋 Fetching SMTP settings from database...');
    const settingsResult = await pool.query(`
      SELECT key, value FROM settings 
      WHERE key IN ('smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_secure', 'contact_email', 'email_notifications')
    `);
    
    const smtpSettings = {};
    settingsResult.rows.forEach(row => {
      smtpSettings[row.key] = row.value;
    });
    
    console.log('📧 SMTP Settings loaded:', Object.keys(smtpSettings));
    console.log('📧 SMTP Settings values:', {
      smtp_host: smtpSettings.smtp_host,
      smtp_port: smtpSettings.smtp_port,
      smtp_user: smtpSettings.smtp_user ? '***configured***' : 'MISSING',
      smtp_pass: smtpSettings.smtp_pass ? '***configured***' : 'MISSING',
      smtp_from: smtpSettings.smtp_from,
      smtp_secure: smtpSettings.smtp_secure,
      contact_email: smtpSettings.contact_email,
      email_notifications: smtpSettings.email_notifications
    });

    // Check email notifications setting
    console.log('🔔 Email notifications enabled?', smtpSettings.email_notifications !== 'false');
    
    // Check if we have minimum SMTP configuration
    const hasSmtpConfig = smtpSettings.smtp_host && smtpSettings.smtp_user && smtpSettings.smtp_pass;
    console.log('🔧 Has SMTP config?', hasSmtpConfig);
    
    if (!hasSmtpConfig) {
      console.log('❌ Missing SMTP configuration:');
      console.log('   - smtp_host:', !!smtpSettings.smtp_host);
      console.log('   - smtp_user:', !!smtpSettings.smtp_user);  
      console.log('   - smtp_pass:', !!smtpSettings.smtp_pass);
      return false;
    }

    // Create transporter (exact same code as contact controller)
    console.log('🔧 Creating transporter...');
    const transporter = nodemailer.createTransporter({
      host: smtpSettings.smtp_host,
      port: parseInt(smtpSettings.smtp_port) || 587,
      secure: smtpSettings.smtp_secure === 'true',
      auth: {
        user: smtpSettings.smtp_user,
        pass: smtpSettings.smtp_pass,
      },
    });

    console.log('📋 Transporter config:', {
      host: smtpSettings.smtp_host,
      port: parseInt(smtpSettings.smtp_port) || 587,
      secure: smtpSettings.smtp_secure === 'true',
      user: smtpSettings.smtp_user
    });

    if (!transporter) {
      console.log('❌ Transporter creation failed');
      return false;
    }

    console.log('✅ Transporter created');

    // Test the connection
    console.log('🔍 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified!');

    // Send test email
    console.log('📤 Sending test email...');
    const mailOptions = {
      from: smtpSettings.smtp_from || smtpSettings.smtp_user,
      to: smtpSettings.contact_email || smtpSettings.smtp_from || smtpSettings.smtp_user,
      subject: 'SMTP Debug Test - ' + new Date().toISOString(),
      html: `
        <h2>🧪 SMTP Debug Test</h2>
        <p>This email was sent directly from the debug script to test SMTP functionality.</p>
        <p><strong>Settings used:</strong></p>
        <ul>
          <li>Host: ${smtpSettings.smtp_host}</li>
          <li>Port: ${parseInt(smtpSettings.smtp_port) || 587}</li>
          <li>Secure: ${smtpSettings.smtp_secure === 'true'}</li>
          <li>User: ${smtpSettings.smtp_user}</li>
          <li>From: ${smtpSettings.smtp_from}</li>
          <li>To: ${smtpSettings.contact_email}</li>
        </ul>
        <p>Time: ${new Date().toLocaleString()}</p>
      `,
      text: `
SMTP Debug Test

This email was sent directly from the debug script to test SMTP functionality.

Settings used:
- Host: ${smtpSettings.smtp_host}
- Port: ${parseInt(smtpSettings.smtp_port) || 587}
- Secure: ${smtpSettings.smtp_secure === 'true'}
- User: ${smtpSettings.smtp_user}
- From: ${smtpSettings.smtp_from}
- To: ${smtpSettings.contact_email}

Time: ${new Date().toLocaleString()}
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully!');
    console.log('📧 Message ID:', result.messageId);
    
    return true;

  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error('📋 Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response
    });
    return false;
  }
}

// Run debug
debugEmailIssue()
  .then(success => {
    console.log(success ? '\n🎉 EMAIL DEBUG PASSED!' : '\n💥 EMAIL DEBUG FAILED!');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Debug script error:', error);
    process.exit(1);
  });
import nodemailer from 'nodemailer';

// Test email functionality with the actual SMTP settings from database
async function testEmail() {
  console.log('🧪 Testing email functionality...');
  
  // SMTP settings from database
  const smtpSettings = {
    host: 'smtp.gmail.com',
    port: 587,
    user: 'smtp@ingasti.com',
    pass: 'qvsatfietzeqfvfh',
    from: 'blog@ingasti.com',
    to: 'blog@ingasti.com',
    secure: false
  };

  console.log('📧 SMTP Configuration:', {
    host: smtpSettings.host,
    port: smtpSettings.port,
    user: smtpSettings.user,
    secure: smtpSettings.secure
  });

  try {
    // Create transporter
    console.log('🔧 Creating transporter...');
    const transporter = nodemailer.createTransporter({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.secure, // false for 587, true for 465
      auth: {
        user: smtpSettings.user,
        pass: smtpSettings.pass,
      },
      debug: true, // Enable debug logs
    });

    // Verify connection
    console.log('🔍 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');

    // Send test email
    console.log('📤 Sending test email...');
    const mailOptions = {
      from: `"Blog Contact Test" <${smtpSettings.from}>`,
      to: smtpSettings.to,
      subject: 'Contact Form Email Test - ' + new Date().toISOString(),
      html: `
        <h2>🧪 Email Test from Contact Form</h2>
        <p>This is a test email to verify SMTP functionality is working.</p>
        <p><strong>Test Details:</strong></p>
        <ul>
          <li>Host: ${smtpSettings.host}</li>
          <li>Port: ${smtpSettings.port}</li>
          <li>User: ${smtpSettings.user}</li>
          <li>Secure: ${smtpSettings.secure}</li>
          <li>Time: ${new Date().toLocaleString()}</li>
        </ul>
        <p>If you receive this email, the SMTP configuration is working correctly! ✅</p>
      `,
      text: `
Email Test from Contact Form

This is a test email to verify SMTP functionality is working.

Test Details:
- Host: ${smtpSettings.host}
- Port: ${smtpSettings.port}
- User: ${smtpSettings.user}
- Secure: ${smtpSettings.secure}
- Time: ${new Date().toLocaleString()}

If you receive this email, the SMTP configuration is working correctly!
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully!');
    console.log('📧 Message ID:', result.messageId);
    console.log('📬 Email details:', result);
    
    return true;
  } catch (error) {
    console.error('❌ Email test failed:', error);
    console.error('📋 Error details:', {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    return false;
  }
}

// Run the test
testEmail()
  .then(success => {
    if (success) {
      console.log('\n🎉 EMAIL TEST PASSED - SMTP is working correctly!');
      process.exit(0);
    } else {
      console.log('\n💥 EMAIL TEST FAILED - Check SMTP configuration');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Test script error:', error);
    process.exit(1);
  });
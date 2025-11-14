import { getDbPool } from "../db.js";
import nodemailer from "nodemailer";
import CoreDB from '../services/CoreDB.js';

// Create email transporter using database settings
const createTransporter = async (settings) => {
  console.log('Creating transporter with settings:', {
    hasHost: !!settings.smtp_host,
    hasUser: !!settings.smtp_user,
    hasPass: !!settings.smtp_pass,
    host: settings.smtp_host,
    port: settings.smtp_port,
    secure: settings.smtp_secure
  });

  // Check if SMTP configuration is available
  if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
    console.warn('SMTP configuration incomplete in database:', {
      smtp_host: !!settings.smtp_host,
      smtp_user: !!settings.smtp_user,
      smtp_pass: !!settings.smtp_pass
    });
    return null;
  }

  try {
    const transporterConfig = {
      host: settings.smtp_host,
      port: parseInt(settings.smtp_port) || 587,
      secure: settings.smtp_secure === 'true', // true for 465, false for other ports
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_pass,
      },
    };
    
    console.log('Creating nodemailer transporter with config:', {
      host: transporterConfig.host,
      port: transporterConfig.port,
      secure: transporterConfig.secure,
      user: transporterConfig.auth.user
    });

    const transporter = nodemailer.createTransport(transporterConfig);
    
    // Test the connection
    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully');
    
    return transporter;
  } catch (error) {
    console.error('❌ Failed to create or verify SMTP transporter:', error);
    return null;
  }
};

export const sendContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        error: "All fields are required",
        fields: { name, email, subject, message }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Please provide a valid email address"
      });
    }

    const pool = getDbPool();

    // Store the contact message in database
    let messageStored = false;
    try {
      await pool.query(
        `INSERT INTO contact_messages (name, email, subject, message, created_at, status) 
         VALUES ($1, $2, $3, $4, NOW(), 'new')`,
        [name, email, subject, message]
      );
      messageStored = true;
      console.log('Contact message stored in database successfully');
    } catch (dbError) {
      console.error("Database storage failed:", dbError.message);
      // If we can't store in database and can't send email, this is a real error
    }

    // Get SMTP settings from CoreDB
    let smtpSettings = {};
    try {
      const smtpKeys = ['smtp.host', 'smtp.port', 'smtp.user', 'smtp.pass', 'smtp.from', 'smtp.secure', 'contact.email', 'email.notifications'];
      
      for (const key of smtpKeys) {
        const value = await CoreDB.getConfig(key);
        if (value !== null) {
          // Convert dot notation to underscore for compatibility with existing code
          const legacyKey = key.replace('.', '_');
          smtpSettings[legacyKey] = value;
        }
      }
      
      console.log('SMTP settings loaded from CoreDB:', Object.keys(smtpSettings));
    } catch (settingsError) {
      console.error('Failed to load SMTP settings from database:', settingsError);
    }

    // Send email notification
    console.log('Creating email transporter with settings:', {
      smtp_host: smtpSettings.smtp_host,
      smtp_port: smtpSettings.smtp_port,  
      smtp_user: smtpSettings.smtp_user,
      smtp_secure: smtpSettings.smtp_secure,
      email_notifications: smtpSettings.email_notifications
    });
    
    const transporter = await createTransporter(smtpSettings);
    let emailSent = false;
    
    console.log('Transporter created:', !!transporter);
    console.log('Email notifications enabled:', smtpSettings.email_notifications !== 'false');
    
    if (transporter && smtpSettings.email_notifications !== 'false') {
      try {
        const mailOptions = {
          from: smtpSettings.smtp_from || `"Blog Contact Form" <${smtpSettings.smtp_user}>`,
          to: smtpSettings.contact_email || smtpSettings.smtp_from || "blog@ingasti.com",
          subject: `Contact Form: ${subject}`,
          html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">New Contact Form Message</h1>
          </div>
          
          <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
            <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #667eea; margin-top: 0; border-bottom: 2px solid #eee; padding-bottom: 10px;">Message Details</h2>
              
              <div style="margin-bottom: 20px;">
                <strong style="color: #555;">Name:</strong><br>
                <span style="font-size: 16px;">${name}</span>
              </div>
              
              <div style="margin-bottom: 20px;">
                <strong style="color: #555;">Email:</strong><br>
                <a href="mailto:${email}" style="color: #667eea; text-decoration: none;">${email}</a>
              </div>
              
              <div style="margin-bottom: 20px;">
                <strong style="color: #555;">Subject:</strong><br>
                <span style="font-size: 16px;">${subject}</span>
              </div>
              
              <div style="margin-bottom: 20px;">
                <strong style="color: #555;">Message:</strong><br>
                <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #667eea; margin-top: 10px; border-radius: 4px;">
                  ${message.replace(/\n/g, '<br>')}
                </div>
              </div>
              
              <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px;">
                <small style="color: #888;">
                  Sent from Blog Contact Form on ${new Date().toLocaleString()}
                </small>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject)}" 
                 style="background: #667eea; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reply to ${name}
              </a>
            </div>
          </div>
        </div>
      `,
      // Also include plain text version
      text: `
New Contact Form Message

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

Sent from Blog Contact Form on ${new Date().toLocaleString()}
      `
    };

        console.log('Attempting to send email with options:', {
          from: mailOptions.from,
          to: mailOptions.to,
          subject: mailOptions.subject
        });
        
        const emailResult = await transporter.sendMail(mailOptions);
        emailSent = true;
        console.log('Contact email sent successfully:', emailResult.messageId);
      } catch (emailError) {
        console.error('Failed to send contact email:', emailError.message);
        // Continue if database storage succeeded
      }
    } else {
      console.log('Email transporter not available, skipping email notification');
    }

    // Return appropriate response based on what succeeded
    if (messageStored || emailSent) {
      let responseMessage = "Message received successfully";
      if (messageStored && emailSent) {
        responseMessage = "Message sent and stored successfully";
      } else if (messageStored) {
        responseMessage = "Message stored successfully. Email notification pending.";
      } else if (emailSent) {
        responseMessage = "Message sent successfully";
      }

      res.status(200).json({
        message: responseMessage,
        success: true,
        stored: messageStored,
        emailed: emailSent
      });
    } else {
      // Both database and email failed
      throw new Error("Failed to store message in database and send email notification");
    }

  } catch (error) {
    console.error("Contact form error:", error);
    res.status(500).json({
      error: "Failed to send message. Please try again later.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

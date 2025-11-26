import React from 'react';
import './terms.css';

export default function Terms() {
  return (
    <div className="terms-container">
      <div className="terms-content">
        <h1>Terms of Service</h1>
        <p className="last-updated">Last updated: August 9, 2025</p>
        
        <div className="terms-section">
          <h2>1. Acceptance of Terms</h2>
          <p>
            Welcome to Bedtime Blog. These Terms of Service ("Terms") govern your use of our website 
            located at <a href="https://bedtime.ingasti.com">bedtime.ingasti.com</a> operated by 
            Bedtime Blog ("us", "we", or "our").
          </p>
          <p>
            By accessing and using our service, you accept and agree to be bound by the terms and 
            provision of this agreement. If you do not agree to abide by the above, please do not 
            use this service.
          </p>
        </div>

        <div className="terms-section">
          <h2>2. Description of Service</h2>
          <p>
            Bedtime Blog is a personal blog platform that provides:
          </p>
          <ul>
            <li>Blog content and articles on various topics</li>
            <li>User authentication through OAuth providers (Google, Facebook, Twitter)</li>
            <li>Comment system for registered users</li>
            <li>Contact forms for communication</li>
            <li>Subscription and notification services</li>
          </ul>
        </div>

        <div className="terms-section">
          <h2>3. User Accounts and Registration</h2>
          
          <h3>Account Creation</h3>
          <p>
            To access certain features of our service, you may be required to create an account 
            using OAuth authentication through Google, Facebook, or Twitter.
          </p>
          
          <h3>Account Responsibilities</h3>
          <ul>
            <li>You are responsible for maintaining the confidentiality of your account</li>
            <li>You agree to provide accurate and complete information</li>
            <li>You are responsible for all activities that occur under your account</li>
            <li>You must notify us immediately of any unauthorized use of your account</li>
          </ul>

          <h3>Account Termination</h3>
          <p>
            We reserve the right to terminate or suspend your account at any time, with or without 
            cause, with or without notice, for conduct that we believe violates these Terms or is 
            harmful to other users, us, or third parties, or for any other reason.
          </p>
        </div>

        <div className="terms-section">
          <h2>4. User Conduct and Content</h2>
          
          <h3>Acceptable Use</h3>
          <p>You agree to use our service only for lawful purposes and in accordance with these Terms. You agree not to:</p>
          <ul>
            <li>Post, upload, or distribute any content that is illegal, harmful, threatening, abusive, defamatory, or otherwise objectionable</li>
            <li>Impersonate any person or entity or falsely state or misrepresent your affiliation</li>
            <li>Engage in spamming, flooding, or other disruptive behavior</li>
            <li>Attempt to gain unauthorized access to our systems or networks</li>
            <li>Use automated systems or bots to access or interact with our service</li>
            <li>Violate any applicable laws or regulations</li>
          </ul>

          <h3>User-Generated Content</h3>
          <p>
            When you post comments or other content on our site:
          </p>
          <ul>
            <li>You retain ownership of your content</li>
            <li>You grant us a non-exclusive license to use, display, and distribute your content on our platform</li>
            <li>You represent that you have the right to post such content</li>
            <li>We reserve the right to remove any content that violates these Terms</li>
          </ul>
        </div>

        <div className="terms-section">
          <h2>5. Privacy and Data Protection</h2>
          <p>
            Your privacy is important to us. Our collection and use of personal information is 
            governed by our <a href="/privacy">Privacy Policy</a>, which is incorporated into 
            these Terms by reference.
          </p>
          
          <h3>OAuth Authentication</h3>
          <p>
            When you use OAuth authentication services:
          </p>
          <ul>
            <li>You authorize us to access certain information from your OAuth provider</li>
            <li>We only collect the minimum information necessary to provide our services</li>
            <li>You can revoke our access at any time through your OAuth provider's settings</li>
          </ul>
        </div>

        <div className="terms-section">
          <h2>6. Intellectual Property Rights</h2>
          
          <h3>Our Content</h3>
          <p>
            The content, features, and functionality of our service, including but not limited to 
            text, graphics, logos, images, and software, are owned by us or our licensors and are 
            protected by copyright, trademark, and other intellectual property laws.
          </p>

          <h3>Limited License</h3>
          <p>
            We grant you a limited, non-exclusive, non-transferable license to access and use our 
            service for personal, non-commercial purposes, subject to these Terms.
          </p>

          <h3>Restrictions</h3>
          <p>You may not:</p>
          <ul>
            <li>Copy, modify, distribute, sell, or lease any part of our service</li>
            <li>Reverse engineer or attempt to extract the source code of our service</li>
            <li>Use our service to create a competing product or service</li>
          </ul>
        </div>

        <div className="terms-section">
          <h2>7. Third-Party Services</h2>
          <p>
            Our service may contain links to third-party websites or services, including OAuth 
            providers (Google, Facebook, Twitter). We are not responsible for:
          </p>
          <ul>
            <li>The availability, accuracy, or content of third-party services</li>
            <li>The privacy practices of third-party services</li>
            <li>Any transactions between you and third-party services</li>
          </ul>
          <p>
            Your use of third-party services is subject to their respective terms and conditions.
          </p>
        </div>

        <div className="terms-section">
          <h2>8. Disclaimers and Limitations of Liability</h2>
          
          <h3>Service Availability</h3>
          <p>
            We strive to provide continuous service but cannot guarantee that our service will be 
            available at all times. We may experience downtime due to maintenance, updates, or 
            technical issues.
          </p>

          <h3>Disclaimer of Warranties</h3>
          <p>
            Our service is provided "as is" and "as available" without warranties of any kind, 
            either express or implied, including but not limited to implied warranties of 
            merchantability, fitness for a particular purpose, or non-infringement.
          </p>

          <h3>Limitation of Liability</h3>
          <p>
            To the fullest extent permitted by law, we shall not be liable for any indirect, 
            incidental, special, consequential, or punitive damages, including but not limited to 
            loss of profits, data, or use, arising out of or relating to your use of our service.
          </p>
        </div>

        <div className="terms-section">
          <h2>9. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless Bedtime Blog and its officers, 
            directors, employees, and agents from and against any claims, liabilities, damages, 
            losses, and expenses, including reasonable legal fees, arising out of or relating to:
          </p>
          <ul>
            <li>Your use of our service</li>
            <li>Your violation of these Terms</li>
            <li>Your violation of any rights of another party</li>
            <li>Any content you post or submit through our service</li>
          </ul>
        </div>

        <div className="terms-section">
          <h2>10. Data Retention and Deletion</h2>
          <p>
            We retain your personal information for as long as necessary to provide our services 
            and comply with legal obligations. You may request deletion of your account and 
            associated data by contacting us.
          </p>
          
          <h3>Account Deletion</h3>
          <p>
            When you delete your account:
          </p>
          <ul>
            <li>Your personal information will be deleted within 30 days</li>
            <li>Comments and public content may be retained but anonymized</li>
            <li>Some information may be retained for legal compliance purposes</li>
          </ul>
        </div>

        <div className="terms-section">
          <h2>11. Modifications to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. We will notify users of 
            material changes by:
          </p>
          <ul>
            <li>Posting the updated Terms on our website</li>
            <li>Updating the "Last updated" date</li>
            <li>Sending notification emails to registered users (for significant changes)</li>
          </ul>
          <p>
            Your continued use of our service after any modifications constitutes your acceptance 
            of the modified Terms.
          </p>
        </div>

        <div className="terms-section">
          <h2>12. Governing Law and Jurisdiction</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of 
            [Your Jurisdiction], without regard to its conflict of law provisions.
          </p>
          <p>
            Any disputes arising from these Terms or your use of our service shall be resolved 
            in the courts of [Your Jurisdiction].
          </p>
        </div>

        <div className="terms-section">
          <h2>13. Severability</h2>
          <p>
            If any provision of these Terms is found to be unenforceable or invalid, that 
            provision shall be limited or eliminated to the minimum extent necessary so that 
            these Terms shall otherwise remain in full force and effect.
          </p>
        </div>

        <div className="terms-section">
          <h2>14. Contact Information</h2>
          <p>
            If you have any questions about these Terms of Service, please contact us:
          </p>
          <div className="contact-info">
            <p><strong>Email:</strong> legal@ingasti.com</p>
            <p><strong>Website:</strong> <a href="https://bedtime.ingasti.com/contact">Contact Form</a></p>
            <p><strong>Address:</strong> [Your Business Address]</p>
          </div>
        </div>

        <div className="terms-section important-notice">
          <h2>15. Important Notice for OAuth Users</h2>
          <p>
            When using OAuth authentication (Google, Facebook, Twitter):
          </p>
          <ul>
            <li>You acknowledge that you have read and agree to the privacy policies of these providers</li>
            <li>We only access the information necessary for authentication and basic profile data</li>
            <li>You can revoke our access at any time through your provider's account settings</li>
            <li>Revoking access may limit or prevent your ability to use certain features of our service</li>
          </ul>
          <p>
            <strong>Provider Links:</strong>
          </p>
          <ul>
            <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a></li>
            <li><a href="https://www.facebook.com/privacy/explanation" target="_blank" rel="noopener noreferrer">Facebook Privacy Policy</a></li>
            <li><a href="https://twitter.com/privacy" target="_blank" rel="noopener noreferrer">Twitter Privacy Policy</a></li>
          </ul>
        </div>

        <div className="terms-footer">
          <p>
            <strong>Effective Date:</strong> August 9, 2025<br/>
            <strong>Version:</strong> 1.0<br/>
            <strong>Next Review Date:</strong> February 9, 2026
          </p>
        </div>
      </div>
    </div>
  );
}

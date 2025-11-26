import React from 'react';
import './privacy.css';

export default function Privacy() {
  return (
    <div className="privacy-container">
      <div className="privacy-content">
        <h1>Privacy Policy</h1>
        <p className="last-updated">Last updated: August 9, 2025</p>
        
        <div className="privacy-section">
          <h2>1. Introduction</h2>
          <p>
            Welcome to Bedtime Blog ("we," "our," or "us"). This Privacy Policy explains how we collect, 
            use, disclose, and safeguard your information when you visit our website{' '}
            <a href="https://bedtime.ingasti.com">bedtime.ingasti.com</a> and use our services.
          </p>
          <p>
            Please read this privacy policy carefully. If you do not agree with the terms of this 
            privacy policy, please do not access the site.
          </p>
        </div>

        <div className="privacy-section">
          <h2>2. Information We Collect</h2>
          
          <h3>Personal Information</h3>
          <p>We may collect the following personal information:</p>
          <ul>
            <li><strong>Account Information:</strong> When you create an account using OAuth providers (Google, Facebook, Twitter), we collect your name, email address, and profile picture.</li>
            <li><strong>Contact Information:</strong> When you contact us through our contact form, we collect your name, email address, and message content.</li>
            <li><strong>Usage Information:</strong> We may collect information about how you use our website, including pages visited, time spent, and interactions.</li>
          </ul>

          <h3>Automatically Collected Information</h3>
          <ul>
            <li><strong>Log Data:</strong> Server logs, IP addresses, browser type, operating system</li>
            <li><strong>Cookies:</strong> We use cookies and similar technologies to enhance your experience</li>
            <li><strong>Analytics:</strong> We may use web analytics to understand site usage patterns</li>
          </ul>
        </div>

        <div className="privacy-section">
          <h2>3. How We Use Your Information</h2>
          <p>We use the information we collect for the following purposes:</p>
          <ul>
            <li>To provide, operate, and maintain our blog services</li>
            <li>To authenticate and manage user accounts</li>
            <li>To respond to comments, questions, and provide customer support</li>
            <li>To send you technical notices, updates, and administrative messages</li>
            <li>To improve our website and develop new features</li>
            <li>To monitor and analyze usage patterns and trends</li>
            <li>To detect, prevent, and address technical issues and security vulnerabilities</li>
          </ul>
        </div>

        <div className="privacy-section">
          <h2>4. OAuth Authentication</h2>
          <p>
            Our website uses OAuth authentication services provided by third-party platforms 
            (Google, Facebook, Twitter) to allow you to log in using your existing accounts.
          </p>
          
          <h3>What OAuth Providers Share With Us:</h3>
          <ul>
            <li><strong>Google:</strong> Name, email address, profile picture</li>
            <li><strong>Facebook:</strong> Name, email address, profile picture</li>
            <li><strong>Twitter:</strong> Username, display name, profile picture</li>
          </ul>
          
          <p>
            We only request the minimum permissions necessary to provide our services. 
            You can revoke these permissions at any time through your respective provider's settings.
          </p>
        </div>

        <div className="privacy-section">
          <h2>5. Information Sharing and Disclosure</h2>
          <p>We do not sell, trade, or otherwise transfer your personal information to third parties, except in the following circumstances:</p>
          
          <ul>
            <li><strong>With Your Consent:</strong> When you explicitly agree to share information</li>
            <li><strong>Service Providers:</strong> With trusted third-party service providers who assist in operating our website</li>
            <li><strong>Legal Requirements:</strong> When required by law, regulation, or legal process</li>
            <li><strong>Safety and Security:</strong> To protect the rights, property, or safety of our users or others</li>
            <li><strong>Business Transfers:</strong> In connection with any merger, sale, or transfer of our business</li>
          </ul>
        </div>

        <div className="privacy-section">
          <h2>6. Data Storage and Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your personal information:
          </p>
          <ul>
            <li>Secure data transmission using SSL/TLS encryption</li>
            <li>Secure database storage with access controls</li>
            <li>Regular security assessments and updates</li>
            <li>Limited access to personal information on a need-to-know basis</li>
          </ul>
          <p>
            However, no method of transmission over the internet or electronic storage is 100% secure. 
            While we strive to protect your information, we cannot guarantee absolute security.
          </p>
        </div>

        <div className="privacy-section">
          <h2>7. Cookies and Tracking Technologies</h2>
          <p>We use cookies and similar tracking technologies to:</p>
          <ul>
            <li>Maintain your login session</li>
            <li>Remember your preferences</li>
            <li>Analyze website traffic and usage patterns</li>
            <li>Improve our services and user experience</li>
          </ul>
          <p>
            You can control cookies through your browser settings. However, disabling cookies 
            may affect the functionality of our website.
          </p>
        </div>

        <div className="privacy-section">
          <h2>8. Your Rights and Choices</h2>
          <p>Depending on your location, you may have the following rights:</p>
          <ul>
            <li><strong>Access:</strong> Request information about the personal data we hold about you</li>
            <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
            <li><strong>Deletion:</strong> Request deletion of your personal data</li>
            <li><strong>Portability:</strong> Request a copy of your data in a structured format</li>
            <li><strong>Objection:</strong> Object to certain processing of your personal data</li>
            <li><strong>Restriction:</strong> Request restriction of processing under certain circumstances</li>
          </ul>
          <p>
            To exercise these rights, please contact us using the information provided below.
          </p>
        </div>

        <div className="privacy-section">
          <h2>9. Children's Privacy</h2>
          <p>
            Our services are not intended for children under the age of 13. We do not knowingly 
            collect personal information from children under 13. If we become aware that we have 
            collected personal information from a child under 13, we will take steps to delete 
            such information promptly.
          </p>
        </div>

        <div className="privacy-section">
          <h2>10. International Data Transfers</h2>
          <p>
            Your information may be transferred to and processed in countries other than your own. 
            These countries may have data protection laws that are different from the laws of your country. 
            We ensure appropriate safeguards are in place to protect your information in accordance 
            with this privacy policy.
          </p>
        </div>

        <div className="privacy-section">
          <h2>11. Updates to This Privacy Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes 
            by posting the new Privacy Policy on this page and updating the "Last updated" date at 
            the top of this Privacy Policy.
          </p>
          <p>
            You are advised to review this Privacy Policy periodically for any changes. 
            Changes to this Privacy Policy are effective when they are posted on this page.
          </p>
        </div>

        <div className="privacy-section">
          <h2>12. Contact Information</h2>
          <p>
            If you have any questions about this Privacy Policy or our privacy practices, 
            please contact us:
          </p>
          <div className="contact-info">
            <p><strong>Email:</strong> privacy@ingasti.com</p>
            <p><strong>Website:</strong> <a href="https://bedtime.ingasti.com/contact">Contact Form</a></p>
            <p><strong>Address:</strong> [Your Business Address]</p>
          </div>
        </div>

        <div className="privacy-section gdpr-section">
          <h2>13. GDPR Compliance (EU Residents)</h2>
          <p>
            If you are a resident of the European Union, you have additional rights under the 
            General Data Protection Regulation (GDPR):
          </p>
          <ul>
            <li>The right to be informed about our collection and use of your personal data</li>
            <li>The right of access to your personal data</li>
            <li>The right to rectification if your personal data is inaccurate or incomplete</li>
            <li>The right to erasure of your personal data</li>
            <li>The right to restrict processing of your personal data</li>
            <li>The right to data portability</li>
            <li>The right to object to processing of your personal data</li>
            <li>The right to withdraw consent at any time</li>
          </ul>
          <p>
            Our lawful basis for processing your personal data includes consent, legitimate interests, 
            and contractual necessity.
          </p>
        </div>

        <div className="privacy-footer">
          <p>
            <strong>Effective Date:</strong> August 9, 2025<br/>
            <strong>Version:</strong> 1.0
          </p>
        </div>
      </div>
    </div>
  );
}

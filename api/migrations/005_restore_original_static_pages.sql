-- Update static pages with original content from backup
-- Purpose: Restore original Privacy Policy and Terms of Service content
-- Date: 2025-10-10

BEGIN;

-- Update Privacy Policy with original content
UPDATE static_pages 
SET content = $PRIVACY$
# Privacy Policy

*Last updated: August 9, 2025*

## 1. Introduction

Welcome to Bedtime Blog ("we," "our," or "us"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website bedtime.ingasti.com and use our services.

Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.

## 2. Information We Collect

### Personal Information
We may collect the following personal information:

- **Account Information:** When you create an account using OAuth providers (Google, Facebook, Twitter), we collect your name, email address, and profile picture.
- **Contact Information:** When you contact us through our contact form, we collect your name, email address, and message content.
- **Usage Information:** We may collect information about how you use our website, including pages visited, time spent, and interactions.

### Automatically Collected Information
- **Log Data:** Server logs, IP addresses, browser type, operating system
- **Cookies:** We use cookies and similar technologies to enhance your experience
- **Analytics:** We may use web analytics to understand site usage patterns

## 3. How We Use Your Information

We use the information we collect for the following purposes:

- To provide, operate, and maintain our blog services
- To authenticate and manage user accounts
- To respond to comments, questions, and provide customer support
- To send you technical notices, updates, and administrative messages
- To improve our website and develop new features
- To monitor and analyze usage patterns and trends
- To detect, prevent, and address technical issues and security vulnerabilities

## 4. OAuth Authentication

Our website uses OAuth authentication services provided by third-party platforms (Google, Facebook, Twitter) to allow you to log in using your existing accounts.

### What OAuth Providers Share With Us:
- **Google:** Name, email address, profile picture
- **Facebook:** Name, email address, profile picture
- **Twitter:** Username, display name, profile picture

We only request the minimum permissions necessary to provide our services. You can revoke these permissions at any time through your respective provider's settings.

## 5. Information Sharing and Disclosure

We do not sell, trade, or otherwise transfer your personal information to third parties, except in the following circumstances:

- **With Your Consent:** When you explicitly agree to share information
- **Service Providers:** With trusted third-party service providers who assist in operating our website
- **Legal Requirements:** When required by law, regulation, or legal process
- **Safety and Security:** To protect the rights, property, or safety of our users or others
- **Business Transfers:** In connection with any merger, sale, or transfer of our business

## 6. Data Storage and Security

We implement appropriate technical and organizational measures to protect your personal information:

- Secure data transmission using SSL/TLS encryption
- Secure database storage with access controls
- Regular security assessments and updates
- Limited access to personal information on a need-to-know basis

However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.

## 7. Your Rights and Choices

Depending on your location, you may have the following rights:

- **Access:** Request information about the personal data we hold about you
- **Correction:** Request correction of inaccurate or incomplete data
- **Deletion:** Request deletion of your personal data
- **Portability:** Request a copy of your data in a structured format
- **Objection:** Object to certain processing of your personal data
- **Restriction:** Request restriction of processing under certain circumstances

To exercise these rights, please contact us using the information provided below.

## 8. Contact Information

If you have any questions about this Privacy Policy or our privacy practices, please contact us:

**Email:** privacy@ingasti.com  
**Website:** bedtime.ingasti.com/contact  
**Address:** [Your Business Address]

*Effective Date: August 9, 2025*  
*Version: 1.0*
$PRIVACY$,
title = 'Privacy Policy',
updated_at = CURRENT_TIMESTAMP
WHERE slug = 'privacy';

-- Update Terms of Service with original content
UPDATE static_pages 
SET content = $TERMS$
# Terms of Service

*Last updated: August 9, 2025*

## 1. Acceptance of Terms

Welcome to Bedtime Blog. These Terms of Service ("Terms") govern your use of our website located at bedtime.ingasti.com operated by Bedtime Blog ("us", "we", or "our").

By accessing and using our service, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.

## 2. Description of Service

Bedtime Blog is a personal blog platform that provides:

- Blog content and articles on various topics
- User authentication through OAuth providers (Google, Facebook, Twitter)
- Comment system for registered users
- Contact forms for communication
- Subscription and notification services

## 3. User Accounts and Registration

### Account Creation
To access certain features of our service, you may be required to create an account using OAuth authentication through Google, Facebook, or Twitter.

### Account Responsibilities
- You are responsible for maintaining the confidentiality of your account
- You agree to provide accurate and complete information
- You are responsible for all activities that occur under your account
- You must notify us immediately of any unauthorized use of your account

### Account Termination
We reserve the right to terminate or suspend your account at any time, with or without cause, with or without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, or for any other reason.

## 4. User Conduct and Content

### Acceptable Use
You agree to use our service only for lawful purposes and in accordance with these Terms. You agree not to:

- Post, upload, or distribute any content that is illegal, harmful, threatening, abusive, defamatory, or otherwise objectionable
- Impersonate any person or entity or falsely state or misrepresent your affiliation
- Engage in spamming, flooding, or other disruptive behavior
- Attempt to gain unauthorized access to our systems or networks
- Use automated systems or bots to access or interact with our service
- Violate any applicable laws or regulations

### User-Generated Content
When you post comments or other content on our site:

- You retain ownership of your content
- You grant us a non-exclusive license to use, display, and distribute your content on our platform
- You represent that you have the right to post such content
- We reserve the right to remove any content that violates these Terms

## 5. Privacy and Data Protection

Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy, which is incorporated into these Terms by reference.

### OAuth Authentication
When you use OAuth authentication services:

- You authorize us to access certain information from your OAuth provider
- We only collect the minimum information necessary to provide our services
- You can revoke our access at any time through your OAuth provider's settings

## 6. Intellectual Property Rights

### Our Content
The content, features, and functionality of our service, including but not limited to text, graphics, logos, images, and software, are owned by us or our licensors and are protected by copyright, trademark, and other intellectual property laws.

### Limited License
We grant you a limited, non-exclusive, non-transferable license to access and use our service for personal, non-commercial purposes, subject to these Terms.

### Restrictions
You may not:
- Copy, modify, distribute, sell, or lease any part of our service
- Reverse engineer or attempt to extract the source code of our service
- Use our service to create a competing product or service

## 7. Disclaimers and Limitations of Liability

### Service Availability
We strive to provide continuous service but cannot guarantee that our service will be available at all times. We may experience downtime due to maintenance, updates, or technical issues.

### Disclaimer of Warranties
Our service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement.

### Limitation of Liability
To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or use, arising out of or relating to your use of our service.

## 8. Contact Information

If you have any questions about these Terms of Service, please contact us:

**Email:** legal@ingasti.com  
**Website:** bedtime.ingasti.com/contact  
**Address:** [Your Business Address]

*Effective Date: August 9, 2025*  
*Version: 1.0*  
*Next Review Date: February 9, 2026*
$TERMS$,
title = 'Terms of Service',
updated_at = CURRENT_TIMESTAMP
WHERE slug = 'terms';

COMMIT;
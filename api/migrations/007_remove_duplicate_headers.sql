-- Remove duplicate headers from static pages content
-- Purpose: Fix duplicate page titles showing twice
-- Date: 2025-10-10

BEGIN;

-- Update Privacy Policy - remove the duplicate h1 tag
UPDATE static_pages 
SET content = $PRIVACY$
<p class="last-updated"><em>Last updated: August 9, 2025</em></p>

<h2>1. Introduction</h2>
<p>Welcome to Bedtime Blog ("we," "our," or "us"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website bedtime.ingasti.com and use our services.</p>
<p>Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.</p>

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

<h2>4. OAuth Authentication</h2>
<p>Our website uses OAuth authentication services provided by third-party platforms (Google, Facebook, Twitter) to allow you to log in using your existing accounts.</p>

<h3>What OAuth Providers Share With Us:</h3>
<ul>
<li><strong>Google:</strong> Name, email address, profile picture</li>
<li><strong>Facebook:</strong> Name, email address, profile picture</li>
<li><strong>Twitter:</strong> Username, display name, profile picture</li>
</ul>
<p>We only request the minimum permissions necessary to provide our services. You can revoke these permissions at any time through your respective provider's settings.</p>

<h2>5. Information Sharing and Disclosure</h2>
<p>We do not sell, trade, or otherwise transfer your personal information to third parties, except in the following circumstances:</p>
<ul>
<li><strong>With Your Consent:</strong> When you explicitly agree to share information</li>
<li><strong>Service Providers:</strong> With trusted third-party service providers who assist in operating our website</li>
<li><strong>Legal Requirements:</strong> When required by law, regulation, or legal process</li>
<li><strong>Safety and Security:</strong> To protect the rights, property, or safety of our users or others</li>
<li><strong>Business Transfers:</strong> In connection with any merger, sale, or transfer of our business</li>
</ul>

<h2>6. Data Storage and Security</h2>
<p>We implement appropriate technical and organizational measures to protect your personal information:</p>
<ul>
<li>Secure data transmission using SSL/TLS encryption</li>
<li>Secure database storage with access controls</li>
<li>Regular security assessments and updates</li>
<li>Limited access to personal information on a need-to-know basis</li>
</ul>
<p>However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.</p>

<h2>7. Your Rights and Choices</h2>
<p>Depending on your location, you may have the following rights:</p>
<ul>
<li><strong>Access:</strong> Request information about the personal data we hold about you</li>
<li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
<li><strong>Deletion:</strong> Request deletion of your personal data</li>
<li><strong>Portability:</strong> Request a copy of your data in a structured format</li>
<li><strong>Objection:</strong> Object to certain processing of your personal data</li>
<li><strong>Restriction:</strong> Request restriction of processing under certain circumstances</li>
</ul>
<p>To exercise these rights, please contact us using the information provided below.</p>

<h2>8. Contact Information</h2>
<p>If you have any questions about this Privacy Policy or our privacy practices, please contact us:</p>
<p><strong>Email:</strong> privacy@ingasti.com<br>
<strong>Website:</strong> <a href="https://bedtime.ingasti.com/contact">bedtime.ingasti.com/contact</a><br>
<strong>Address:</strong> [Your Business Address]</p>

<p class="footer-info"><em>Effective Date: August 9, 2025<br>Version: 1.0</em></p>
$PRIVACY$,
updated_at = CURRENT_TIMESTAMP
WHERE slug = 'privacy';

-- Update Terms of Service - remove the duplicate h1 tag
UPDATE static_pages 
SET content = $TERMS$
<p class="last-updated"><em>Last updated: August 9, 2025</em></p>

<h2>1. Acceptance of Terms</h2>
<p>Welcome to Bedtime Blog. These Terms of Service ("Terms") govern your use of our website located at bedtime.ingasti.com operated by Bedtime Blog ("us", "we", or "our").</p>
<p>By accessing and using our service, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.</p>

<h2>2. Description of Service</h2>
<p>Bedtime Blog is a personal blog platform that provides:</p>
<ul>
<li>Blog content and articles on various topics</li>
<li>User authentication through OAuth providers (Google, Facebook, Twitter)</li>
<li>Comment system for registered users</li>
<li>Contact forms for communication</li>
<li>Subscription and notification services</li>
</ul>

<h2>3. User Accounts and Registration</h2>

<h3>Account Creation</h3>
<p>To access certain features of our service, you may be required to create an account using OAuth authentication through Google, Facebook, or Twitter.</p>

<h3>Account Responsibilities</h3>
<ul>
<li>You are responsible for maintaining the confidentiality of your account</li>
<li>You agree to provide accurate and complete information</li>
<li>You are responsible for all activities that occur under your account</li>
<li>You must notify us immediately of any unauthorized use of your account</li>
</ul>

<h3>Account Termination</h3>
<p>We reserve the right to terminate or suspend your account at any time, with or without cause, with or without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, or for any other reason.</p>

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
<p>When you post comments or other content on our site:</p>
<ul>
<li>You retain ownership of your content</li>
<li>You grant us a non-exclusive license to use, display, and distribute your content on our platform</li>
<li>You represent that you have the right to post such content</li>
<li>We reserve the right to remove any content that violates these Terms</li>
</ul>

<h2>5. Privacy and Data Protection</h2>
<p>Your privacy is important to us. Our collection and use of personal information is governed by our <a href="/privacy">Privacy Policy</a>, which is incorporated into these Terms by reference.</p>

<h3>OAuth Authentication</h3>
<p>When you use OAuth authentication services:</p>
<ul>
<li>You authorize us to access certain information from your OAuth provider</li>
<li>We only collect the minimum information necessary to provide our services</li>
<li>You can revoke our access at any time through your OAuth provider's settings</li>
</ul>

<h2>6. Intellectual Property Rights</h2>

<h3>Our Content</h3>
<p>The content, features, and functionality of our service, including but not limited to text, graphics, logos, images, and software, are owned by us or our licensors and are protected by copyright, trademark, and other intellectual property laws.</p>

<h3>Limited License</h3>
<p>We grant you a limited, non-exclusive, non-transferable license to access and use our service for personal, non-commercial purposes, subject to these Terms.</p>

<h3>Restrictions</h3>
<p>You may not:</p>
<ul>
<li>Copy, modify, distribute, sell, or lease any part of our service</li>
<li>Reverse engineer or attempt to extract the source code of our service</li>
<li>Use our service to create a competing product or service</li>
</ul>

<h2>7. Disclaimers and Limitations of Liability</h2>

<h3>Service Availability</h3>
<p>We strive to provide continuous service but cannot guarantee that our service will be available at all times. We may experience downtime due to maintenance, updates, or technical issues.</p>

<h3>Disclaimer of Warranties</h3>
<p>Our service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, or non-infringement.</p>

<h3>Limitation of Liability</h3>
<p>To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or use, arising out of or relating to your use of our service.</p>

<h2>8. Contact Information</h2>
<p>If you have any questions about these Terms of Service, please contact us:</p>
<p><strong>Email:</strong> legal@ingasti.com<br>
<strong>Website:</strong> <a href="https://bedtime.ingasti.com/contact">bedtime.ingasti.com/contact</a><br>
<strong>Address:</strong> [Your Business Address]</p>

<p class="footer-info"><em>Effective Date: August 9, 2025<br>Version: 1.0<br>Next Review Date: February 9, 2026</em></p>
$TERMS$,
updated_at = CURRENT_TIMESTAMP
WHERE slug = 'terms';

COMMIT;
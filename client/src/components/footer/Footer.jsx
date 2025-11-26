import React from 'react';
import { useSocialLinks } from '../../hooks/useSocialLinks';
import { Link } from 'react-router-dom';
import './footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { socialLinks, loading } = useSocialLinks();

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>Bedtime Blog</h3>
          <p>Personal thoughts, experiences, and stories to help you unwind at the end of the day.</p>
        </div>

        <div className="footer-section">
          <h4>Quick Links</h4>
          <ul className="footer-links">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/contact">Contact</Link></li>
            <li><Link to="/category/technology">Technology</Link></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4>Legal</h4>
          <ul className="footer-links">
            <li><Link to="/privacy">Privacy Policy</Link></li>
            <li><Link to="/terms">Terms of Service</Link></li>
          </ul>
        </div>

        <div className="footer-section">
          <h4>Connect</h4>
          <p>Follow us on social media for updates and new content.</p>
          <div className="footer-social">
            {(!loading && socialLinks.linkedin) && (
              <a
                href={socialLinks.linkedin}
                className="social-link"
                aria-label="LinkedIn"
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="fa-brands fa-linkedin"></i>
              </a>
            )}
            {(!loading && socialLinks.twitter) && (
              <a
                href={socialLinks.twitter}
                className="social-link"
                aria-label="X (Twitter)"
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="fa-brands fa-x-twitter"></i>
              </a>
            )}
            {(!loading && socialLinks.instagram) && (
              <a
                href={socialLinks.instagram}
                className="social-link"
                aria-label="Instagram"
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="fa-brands fa-instagram"></i>
              </a>
            )}
            {(!loading && socialLinks.threads) && (
              <a
                href={socialLinks.threads}
                className="social-link"
                aria-label="Threads"
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="fa-brands fa-threads"></i>
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-copyright">
          <p>&copy; {currentYear} Bedtime Blog. All rights reserved.</p>
        </div>
        <div className="footer-legal-links">
          <Link to="/privacy">Privacy</Link>
          <span className="separator">•</span>
          <Link to="/terms">Terms</Link>
        </div>
      </div>
    </footer>
  );
}

import { useState } from 'react';
import { API_ENDPOINTS } from '../../config/api.js';
import './contact.css';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const response = await fetch(API_ENDPOINTS.CONTACT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitStatus('success');
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: ''
        });
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="contact">
      <div className="contactWrapper">
        <div className="contactHeader">
          <h1 className="contactTitle">Get In Touch</h1>
          <p className="contactSubtitle">
            Have a question, suggestion, or just want to say hello? 
            We'd love to hear from you. Drop us a message and we'll get back to you as soon as possible.
          </p>
        </div>

        <div className="contactContent">
          <div className="contactInfo">
            <h2>Let's Connect</h2>
            <p>
              Whether you have feedback about our content, want to collaborate, 
              or have ideas for future posts, your messages are always welcome.
            </p>
            
            <div className="contactFeatures">
              <div className="contactFeature">
                <i className="fa-solid fa-clock"></i>
                <div>
                  <h3>Quick Response</h3>
                  <p>We typically respond within 24 hours</p>
                </div>
              </div>
              <div className="contactFeature">
                <i className="fa-solid fa-shield-halved"></i>
                <div>
                  <h3>Privacy First</h3>
                  <p>Your information is safe and never shared</p>
                </div>
              </div>
              <div className="contactFeature">
                <i className="fa-solid fa-heart"></i>
                <div>
                  <h3>Community Driven</h3>
                  <p>We value every reader's input and feedback</p>
                </div>
              </div>
            </div>
          </div>

          <form className="contactForm" onSubmit={handleSubmit}>
            <div className="formGroup">
              <label htmlFor="name">Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Your full name"
              />
            </div>

            <div className="formGroup">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="your.email@example.com"
              />
            </div>

            <div className="formGroup">
              <label htmlFor="subject">Subject *</label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                placeholder="What's this about?"
              />
            </div>

            <div className="formGroup">
              <label htmlFor="message">Message *</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows="6"
                placeholder="Tell us what's on your mind..."
              ></textarea>
            </div>

            <button 
              type="submit" 
              className="submitButton"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  Sending...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-paper-plane"></i>
                  Send Message
                </>
              )}
            </button>

            {submitStatus === 'success' && (
              <div className="submitMessage success">
                <i className="fa-solid fa-check-circle"></i>
                Thank you! Your message has been sent successfully. We'll get back to you soon.
              </div>
            )}

            {submitStatus === 'error' && (
              <div className="submitMessage error">
                <i className="fa-solid fa-exclamation-triangle"></i>
                Sorry, there was an error sending your message. Please try again later.
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

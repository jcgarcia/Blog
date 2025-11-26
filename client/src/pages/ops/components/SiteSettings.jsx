import React, { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../../../config/api';
import './SiteSettings.css';

export default function SiteSettings() {
  const [settings, setSettings] = useState({
    blogTitle: 'Guilt & Pleasure Bedtime',
    blogDescription: 'A personal blog about life experiences',
    requireApproval: true,
    enableModeration: true,
    enableAutoSave: true,
    autoSaveInterval: 30,
    // SMTP Email Settings
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    smtpFrom: '',
    smtpSecure: false,
    emailNotifications: true,
    contactEmail: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Get the admin token from localStorage
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        throw new Error('No admin token found. Please log in again.');
      }
      
      const response = await fetch(API_ENDPOINTS.SETTINGS.GET_ADMIN, {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        console.log('Loaded settings:', data);
        
        // Map database keys to form fields with proper defaults
        const mappedSettings = {
          blogTitle: data.blog_title || data.blogTitle || 'Guilt & Pleasure Bedtime',
          blogDescription: data.blog_description || data.blogDescription || 'A personal blog about life experiences',
          requireApproval: data.require_approval ? data.require_approval === 'true' : true,
          enableModeration: data.enable_moderation ? data.enable_moderation === 'true' : true,
          enableAutoSave: data.enable_auto_save ? data.enable_auto_save === 'true' : true,
          autoSaveInterval: parseInt(data.auto_save_interval) || data.autoSaveInterval || 30,
          // SMTP Email Settings
          smtpHost: data.smtp_host || '',
          smtpPort: data.smtp_port || '587',
          smtpUser: data.smtp_user || '',
          smtpPass: data.smtp_pass || '',
          smtpFrom: data.smtp_from || '',
          smtpSecure: data.smtp_secure ? data.smtp_secure === 'true' : false,
          emailNotifications: data.email_notifications ? data.email_notifications === 'true' : true,
          contactEmail: data.contact_email || ''
        };
        
        setSettings(mappedSettings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      setMessage('');
      
      // Map form fields to database keys with safe defaults
      const settingsToSave = {
        blog_title: settings.blogTitle || '',
        blog_description: settings.blogDescription || '',
        require_approval: (settings.requireApproval || false).toString(),
        enable_moderation: (settings.enableModeration || false).toString(),
        enable_auto_save: (settings.enableAutoSave || false).toString(),
        auto_save_interval: (settings.autoSaveInterval || 30).toString(),
        // SMTP Email Settings
        smtp_host: settings.smtpHost || '',
        smtp_port: settings.smtpPort || '587',
        smtp_user: settings.smtpUser || '',
        smtp_pass: settings.smtpPass || '',
        smtp_from: settings.smtpFrom || '',
        smtp_secure: (settings.smtpSecure || false).toString(),
        email_notifications: (settings.emailNotifications || true).toString(),
        contact_email: settings.contactEmail || ''
      };
      
      console.log('Saving settings:', settingsToSave);
      
      // Get the admin token from localStorage
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        throw new Error('No admin token found. Please log in again.');
      }
      
      const response = await fetch(API_ENDPOINTS.SETTINGS.UPDATE, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        credentials: 'include',
        body: JSON.stringify(settingsToSave)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Settings saved successfully:', result);
        setMessage('Settings saved successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        const error = await response.text();
        console.error('Failed to save settings:', error);
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('Error saving settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="site-settings">
      <div className="section-header">
        <h2>Site Settings</h2>
        <button 
          className="btn-primary" 
          onClick={saveSettings}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {message && (
        <div className={`settings-message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
      
      <div className="settings-section">
        <h3>General Settings</h3>
        <div className="setting-item">
          <label>Blog Title</label>
          <input 
            type="text" 
            name="blogTitle"
            value={settings.blogTitle}
            onChange={handleInputChange}
          />
        </div>
        <div className="setting-item">
          <label>Blog Description</label>
          <textarea 
            name="blogDescription"
            value={settings.blogDescription}
            onChange={handleInputChange}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3>Editor Configuration</h3>
        <div className="setting-item">
          <label>
            <input 
              type="checkbox" 
              name="enableAutoSave"
              checked={settings.enableAutoSave}
              onChange={handleInputChange}
            />
            Enable auto-save for posts
          </label>
        </div>
        <div className="setting-item">
          <label>Auto-save interval (seconds)</label>
          <input 
            type="number" 
            name="autoSaveInterval"
            value={settings.autoSaveInterval}
            onChange={handleInputChange}
            min="10"
            max="300"
          />
        </div>
      </div>

      <div className="settings-section">
        <h3>Security Settings</h3>
        <div className="setting-item">
          <label>
            <input 
              type="checkbox" 
              name="requireApproval"
              checked={settings.requireApproval}
              onChange={handleInputChange}
            />
            Require admin approval for new posts
          </label>
        </div>
        <div className="setting-item">
          <label>
            <input 
              type="checkbox" 
              name="enableModeration"
              checked={settings.enableModeration}
              onChange={handleInputChange}
            />
            Enable comment moderation
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>Email & SMTP Configuration</h3>
        <div className="setting-item">
          <label>
            <input 
              type="checkbox" 
              name="emailNotifications"
              checked={settings.emailNotifications}
              onChange={handleInputChange}
            />
            Enable email notifications
          </label>
        </div>
        <div className="setting-item">
          <label>Contact Email Address</label>
          <input 
            type="email" 
            name="contactEmail"
            value={settings.contactEmail}
            onChange={handleInputChange}
            placeholder="blog@ingasti.com"
          />
          <small>Email address where contact form messages will be sent</small>
        </div>
        <div className="setting-item">
          <label>SMTP Host</label>
          <input 
            type="text" 
            name="smtpHost"
            value={settings.smtpHost}
            onChange={handleInputChange}
            placeholder="smtp.gmail.com"
          />
        </div>
        <div className="setting-item">
          <label>SMTP Port</label>
          <input 
            type="number" 
            name="smtpPort"
            value={settings.smtpPort}
            onChange={handleInputChange}
            placeholder="587"
          />
        </div>
        <div className="setting-item">
          <label>SMTP Username</label>
          <input 
            type="text" 
            name="smtpUser"
            value={settings.smtpUser}
            onChange={handleInputChange}
            placeholder="smtp@ingasti.com"
          />
        </div>
        <div className="setting-item">
          <label>SMTP Password</label>
          <input 
            type="password" 
            name="smtpPass"
            value={settings.smtpPass}
            onChange={handleInputChange}
            placeholder="App password or SMTP password"
          />
        </div>
        <div className="setting-item">
          <label>From Email Address</label>
          <input 
            type="email" 
            name="smtpFrom"
            value={settings.smtpFrom}
            onChange={handleInputChange}
            placeholder="blog@ingasti.com"
          />
          <small>Email address that will appear in the "From" field</small>
        </div>
        <div className="setting-item">
          <label>
            <input 
              type="checkbox" 
              name="smtpSecure"
              checked={settings.smtpSecure}
              onChange={handleInputChange}
            />
            Use SSL/TLS (enable for port 465, disable for port 587)
          </label>
        </div>
      </div>

      {/* OAuth Settings have been moved to the dedicated Auth tab */}
    </div>
  );
}

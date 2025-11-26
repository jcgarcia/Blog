import React, { useState, useEffect } from 'react';
import './CognitoLogin.css';

export default function CognitoLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [cognitoConfig, setCognitoConfig] = useState(null);

  // Load Cognito configuration from API
  useEffect(() => {
    const loadCognitoConfig = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'https://bapi.ingasti.com';
        const response = await fetch(`${apiUrl}/api/settings`);
        const settings = await response.json();
        
        if (settings['oauth.cognito_client_id'] && settings['oauth.cognito_domain']) {
          setCognitoConfig({
            domain: settings['oauth.cognito_domain'],
            clientId: settings['oauth.cognito_client_id'],
            redirectUri: (settings['oauth.frontend_url'] || window.location.origin) + '/ops/cognito-callback'
          });
          console.log('✅ Cognito configuration loaded from API for CognitoLogin');
        } else {
          console.warn('⚠️ Cognito configuration not found in API settings');
          // Fallback to hardcoded values if API fails
          setCognitoConfig({
            domain: 'blog-auth-1756980364.auth.eu-west-2.amazoncognito.com',
            clientId: '50bvr2ect5ja74rc3qtdb3jn1a',
            redirectUri: window.location.origin + '/ops/cognito-callback'
          });
        }
      } catch (error) {
        console.error('Failed to load Cognito config from API:', error);
        // Fallback to hardcoded values if API fails
        setCognitoConfig({
          domain: 'blog-auth-1756980364.auth.eu-west-2.amazoncognito.com',
          clientId: '50bvr2ect5ja74rc3qtdb3jn1a',
          redirectUri: window.location.origin + '/ops/cognito-callback'
        });
      }
    };
    
    loadCognitoConfig();
  }, []);

  const handleCognitoLogin = () => {
    if (!cognitoConfig) {
      console.error('Cognito configuration not loaded');
      return;
    }
    
    setIsLoading(true);
    
    const redirectUri = encodeURIComponent(cognitoConfig.redirectUri);
    const responseType = 'code';
    const scope = 'email+openid+profile';
    
    const cognitoUrl = `https://${cognitoConfig.domain}/oauth2/authorize?` +
      `client_id=${cognitoConfig.clientId}&` +
      `response_type=${responseType}&` +
      `scope=${scope}&` +
      `redirect_uri=${redirectUri}`;
    
    // Redirect to Cognito Hosted UI
    window.location.href = cognitoUrl;
  };

  const handleSignUp = () => {
    if (!cognitoConfig) {
      console.error('Cognito configuration not loaded');
      return;
    }
    
    const redirectUri = encodeURIComponent(cognitoConfig.redirectUri);
    
    const signUpUrl = `https://${cognitoConfig.domain}/signup?` +
      `client_id=${cognitoConfig.clientId}&` +
      `response_type=code&` +
      `scope=email+openid+profile&` +
      `redirect_uri=${redirectUri}`;
    
    window.location.href = signUpUrl;
  };

  return (
    <div className="cognito-login">
      <div className="cognito-login-card">
        <div className="cognito-header">
          <h2>🔐 AWS Cognito Authentication</h2>
          <p>Secure authentication powered by AWS Cognito</p>
        </div>

        <div className="cognito-demo-section">
          <h3>🎯 Interview Demonstration</h3>
          <p>Click below to test the Cognito authentication flow:</p>
          
          <div className="cognito-actions">
            <button 
              className="btn-cognito-login"
              onClick={handleCognitoLogin}
              disabled={isLoading || !cognitoConfig}
            >
              {isLoading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Redirecting...
                </>
              ) : !cognitoConfig ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Loading Configuration...
                </>
              ) : (
                <>
                  <i className="fa-brands fa-aws"></i> Login with Cognito
                </>
              )}
            </button>

            <button 
              className="btn-cognito-signup"
              onClick={handleSignUp}
              disabled={!cognitoConfig}
            >
              <i className="fa-solid fa-user-plus"></i> Sign Up
            </button>
          </div>
        </div>

        <div className="cognito-info">
          <h3>📋 Technical Implementation</h3>
          <div className="tech-details">
            <div className="detail-item">
              <strong>Authentication Flow:</strong>
              <span>OAuth 2.0 Authorization Code Flow</span>
            </div>
            <div className="detail-item">
              <strong>Client ID:</strong>
              <span>{cognitoConfig?.clientId || 'Loading...'}</span>
            </div>
            <div className="detail-item">
              <strong>Domain:</strong>
              <span>{cognitoConfig?.domain || 'Loading...'}</span>
            </div>
            <div className="detail-item">
              <strong>Configuration Source:</strong>
              <span>API-driven from CoreDB</span>
            </div>
          </div>
        </div>

        <div className="cognito-features">
          <h3>✨ Key Features</h3>
          <ul>
            <li>🔒 Secure JWT token-based authentication</li>
            <li>🌐 OAuth 2.0 and OpenID Connect compliant</li>
            <li>📱 Multi-factor authentication ready</li>
            <li>🔑 Password policies and complexity rules</li>
            <li>📧 Email verification and password recovery</li>
            <li>⚡ Scalable AWS managed service</li>
          </ul>
        </div>

        <div className="cognito-architecture">
          <h3>🏗️ Architecture Benefits</h3>
          <div className="architecture-points">
            <div className="arch-point">
              <strong>Decoupled:</strong> Authentication service separate from main application
            </div>
            <div className="arch-point">
              <strong>Scalable:</strong> AWS handles millions of users automatically
            </div>
            <div className="arch-point">
              <strong>Secure:</strong> Industry-standard security protocols
            </div>
            <div className="arch-point">
              <strong>Cost-effective:</strong> Pay only for active users
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

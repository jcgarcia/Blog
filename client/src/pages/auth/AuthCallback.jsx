import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import './auth-callback.css';

export default function AuthCallback() {
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing authentication...');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithCognito } = useUser();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (error) {
          console.error('Cognito auth error:', { error, errorDescription });
          setStatus('error');
          setMessage(errorDescription || 'Authentication failed');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        if (!code) {
          setStatus('error');
          setMessage('No authorization code received');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        setMessage('Exchanging authorization code...');

        // Exchange the authorization code for tokens
        const result = await loginWithCognito(code);
        
        if (result.success) {
          setStatus('success');
          setMessage('Login successful! Redirecting...');
          setTimeout(() => navigate('/'), 1500);
        } else {
          setStatus('error');
          setMessage(result.message || 'Login failed');
          setTimeout(() => navigate('/login'), 3000);
        }

      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage('Authentication processing failed');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, loginWithCognito]);

  return (
    <div className="auth-callback">
      <div className="auth-callback-container">
        <div className={`auth-status ${status}`}>
          {status === 'processing' && (
            <div className="auth-processing">
              <div className="spinner">
                <i className="fa-solid fa-spinner fa-spin fa-2x"></i>
              </div>
              <h2>Authenticating...</h2>
              <p>{message}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="auth-success">
              <div className="success-icon">
                <i className="fa-solid fa-check-circle fa-2x"></i>
              </div>
              <h2>Welcome!</h2>
              <p>{message}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="auth-error">
              <div className="error-icon">
                <i className="fa-solid fa-exclamation-triangle fa-2x"></i>
              </div>
              <h2>Authentication Failed</h2>
              <p>{message}</p>
              <button onClick={() => navigate('/login')} className="retry-button">
                Return to Login
              </button>
            </div>
          )}
        </div>

        <div className="auth-info">
          <p>
            <i className="fa-solid fa-shield-halved"></i>
            Secured by AWS Cognito
          </p>
        </div>
      </div>
    </div>
  );
}

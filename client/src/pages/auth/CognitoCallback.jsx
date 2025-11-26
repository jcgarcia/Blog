import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import './callback.css';

export default function CognitoCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithCognito } = useUser();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const processedRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent multiple processing of the same callback
      if (processedRef.current) {
        return;
      }
      processedRef.current = true;
      try {
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');

        if (errorParam) {
          setError(`Authentication failed: ${errorParam}`);
          setStatus('error');
          return;
        }

        if (!code) {
          setError('No authorization code received');
          setStatus('error');
          return;
        }

        // Use the UserContext loginWithCognito function
        const result = await loginWithCognito(code);

        if (result.success) {
          setStatus('success');
          navigate('/');
        } else {
          setError(result.message || 'Authentication failed');
          setStatus('error');
        }
      } catch (err) {
        console.error('Cognito callback error:', err);
        setError('Authentication failed. Please try again.');
        setStatus('error');
      }
    };

    handleCallback();
  }, [searchParams, navigate, loginWithCognito]);

  const handleRetry = () => {
    navigate('/login');
  };

  if (status === 'processing') {
    return (
      <div className="auth-callback">
        <div className="auth-callback-container">
          <div className="auth-loading">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <h2>Completing Sign In...</h2>
            <p>Please wait while we securely log you in.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="auth-callback">
        <div className="auth-callback-container">
          <div className="auth-error">
            <i className="fa-solid fa-exclamation-triangle"></i>
            <h2>Authentication Failed</h2>
            <p>{error}</p>
            <button onClick={handleRetry} className="retry-button">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-callback">
      <div className="auth-callback-container">
        <div className="auth-success">
          <i className="fa-solid fa-check-circle"></i>
          <h2>Successfully Signed In!</h2>
          <p>Redirecting to homepage...</p>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../../contexts/AdminContext';
import "./adminlogin.css";

export default function AdminLogin() {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { adminLogin, isAdmin } = useAdmin();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (isAdmin) {
      navigate('/ops');
    }
  }, [isAdmin, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!credentials.username || !credentials.password) {
      setError('Please enter both username and password');
      setIsLoading(false);
      return;
    }

    try {
      const result = await adminLogin(credentials);
      
      if (result.success) {
        navigate('/ops');
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="login">
      <div className="login-container">
        <div className="login-header">
          <i className="fa-solid fa-shield-halved"></i>
          <span className="loginTitle">Admin Access</span>
        </div>
        
        <form className="loginForm" onSubmit={handleSubmit}>
          {error && (
            <div className="login-error">
              <i className="fa-solid fa-exclamation-triangle"></i>
              {error}
            </div>
          )}
          
          <div className="login-field">
            <label>Username</label>
            <input 
              type="text" 
              name="username"
              className="loginInput" 
              placeholder="Enter admin username" 
              value={credentials.username}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>
          
          <div className="login-field">
            <label>Password</label>
            <input 
              type="password" 
              name="password"
              className="loginInput" 
              placeholder="Enter admin password" 
              value={credentials.password}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>
          
          <button 
            type="submit" 
            className={`loginButton ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                Authenticating...
              </>
            ) : (
              <>
                <i className="fa-solid fa-key"></i>
                Admin Login
              </>
            )}
          </button>
        </form>

        <div className="login-info">
          <p>
            <i className="fa-solid fa-info-circle"></i>
            This is a secure admin area. Only authorized personnel may access.
          </p>
        </div>
      </div>
    </div>
  );
}
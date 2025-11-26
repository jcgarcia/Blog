import React from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import './protectedroute.css';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { isAdmin, isLoading } = useAdmin();

  if (isLoading) {
    return (
      <div className="protected-loading">
        <div className="loading-spinner"></div>
        <p>Verifying credentials...</p>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="protected-unauthorized">
        <div className="unauthorized-content">
          <div className="unauthorized-icon">
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          <h1>Restricted Area</h1>
          <p>This is a private administration area restricted to authorized personnel only.</p>
          <div className="unauthorized-details">
            <h3>Access Requirements:</h3>
            <ul>
              <li>Valid administrator credentials</li>
              <li>Proper security clearance</li>
              <li>System authorization</li>
            </ul>
          </div>
          <div className="unauthorized-actions">
            <button 
              className="btn-admin-login"
              onClick={() => window.location.href = '/adminlogin'}
            >
              <i className="fa-solid fa-key"></i>
              Admin Login
            </button>
            <button 
              className="btn-go-home"
              onClick={() => window.location.href = '/'}
            >
              <i className="fa-solid fa-home"></i>
              Return Home
            </button>
          </div>
          <div className="unauthorized-footer">
            <p>
              <i className="fa-solid fa-info-circle"></i>
              If you believe you should have access, please contact the system administrator.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;

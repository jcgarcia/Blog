import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api.js';

const AdminContext = createContext();

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

export const AdminProvider = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [adminUser, setAdminUser] = useState(null);

  // Check for existing admin session on component mount
  useEffect(() => {
    checkAdminAuth();
  }, []);

  const checkAdminAuth = async () => {
    try {
      const adminToken = localStorage.getItem('adminToken');
      if (!adminToken) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      // Verify token with backend
      const response = await fetch(API_ENDPOINTS.ADMIN.VERIFY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIsAdmin(true);
          setAdminUser(data.user);
        } else {
          // Only remove token for genuine authentication failures
          const isAuthFailure = data.message && (
            data.message.includes('Invalid token') ||
            data.message.includes('Token expired') ||
            data.message.includes('No token provided')
          );
          if (isAuthFailure) {
            console.log('Authentication failure detected, clearing token:', data.message);
            localStorage.removeItem('adminToken');
          } else {
            console.log('Non-auth error, keeping token:', data.message);
          }
          setIsAdmin(false);
        }
      } else {
        // Check if this is a genuine authentication failure or infrastructure issue
        let shouldClearToken = false;
        try {
          const errorData = await response.json();
          shouldClearToken = response.status === 401 && errorData.message && (
            errorData.message.includes('Invalid token') ||
            errorData.message.includes('Token expired') ||
            errorData.message.includes('No token provided') ||
            errorData.message.includes('Authentication required')
          );
          if (shouldClearToken) {
            console.log('Authentication failure (HTTP error), clearing token:', errorData.message);
            localStorage.removeItem('adminToken');
          } else {
            console.log('Infrastructure error, keeping token. Status:', response.status, 'Message:', errorData.message);
          }
        } catch (jsonError) {
          // If we can't parse the error response, it's likely a network/infrastructure issue
          console.log('Network/infrastructure error, keeping token. Status:', response.status);
        }
        setIsAdmin(false);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Admin auth check failed (network error):', error);
      // Network errors should not clear tokens - could be temporary connectivity issues
      console.log('Network error detected, keeping adminToken for retry later');
      setIsAdmin(false);
      setIsLoading(false);
    }
  };

  const adminLogin = async (credentials) => {
    try {
      setIsLoading(true);
      
      // Call the real API
      const response = await fetch(API_ENDPOINTS.ADMIN.LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        localStorage.setItem('adminToken', data.token);
        
        setIsAdmin(true);
        setAdminUser(data.user);
        
        setIsLoading(false);
        return { success: true, message: data.message };
      } else {
        setIsLoading(false);
        return { success: false, message: data.message || 'Login failed' };
      }
    } catch (error) {
      console.error('Admin login failed:', error);
      setIsLoading(false);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  const adminLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAdmin(false);
    setAdminUser(null);
  };

  const value = {
    isAdmin,
    isLoading,
    adminUser,
    adminLogin,
    adminLogout,
    checkAdminAuth
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};

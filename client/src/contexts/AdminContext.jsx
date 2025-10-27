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
      console.log('🔍 checkAdminAuth: Starting auth check. Token exists:', !!adminToken);
      if (!adminToken) {
        console.log('❌ checkAdminAuth: No token found in localStorage');
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      console.log('🔍 checkAdminAuth: Verifying token with backend...');
      // Verify token with backend
      const response = await fetch(API_ENDPOINTS.ADMIN.VERIFY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      });

      console.log('🔍 checkAdminAuth: Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ checkAdminAuth: Response OK, data:', data);
        if (data.success) {
          console.log('✅ checkAdminAuth: Setting isAdmin = true');
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
            console.log('❌ checkAdminAuth: Authentication failure detected, clearing token:', data.message);
            localStorage.removeItem('adminToken');
          } else {
            console.log('⚠️ checkAdminAuth: Non-auth error, keeping token:', data.message);
          }
          setIsAdmin(false);
        }
      } else {
        console.log('❌ checkAdminAuth: Response not OK, status:', response.status);
        // Check if this is a genuine authentication failure or infrastructure issue
        let shouldClearToken = false;
        try {
          const errorData = await response.json();
          console.log('❌ checkAdminAuth: Error data:', errorData);
          shouldClearToken = response.status === 401 && errorData.message && (
            errorData.message.includes('Invalid token') ||
            errorData.message.includes('Token expired') ||
            errorData.message.includes('No token provided') ||
            errorData.message.includes('Authentication required')
          );
          if (shouldClearToken) {
            console.log('❌ checkAdminAuth: Authentication failure (HTTP error), clearing token:', errorData.message);
            localStorage.removeItem('adminToken');
          } else {
            console.log('⚠️ checkAdminAuth: Infrastructure error, keeping token. Status:', response.status, 'Message:', errorData.message);
          }
        } catch (jsonError) {
          // If we can't parse the error response, it's likely a network/infrastructure issue
          console.log('⚠️ checkAdminAuth: Network/infrastructure error, keeping token. Status:', response.status);
        }
        setIsAdmin(false);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('❌ checkAdminAuth: Network error:', error);
      // Network errors should not clear tokens - could be temporary connectivity issues
      console.log('⚠️ checkAdminAuth: Network error detected, keeping adminToken for retry later');
      setIsAdmin(false);
      setIsLoading(false);
    }
  };

  const adminLogin = async (credentials) => {
    try {
      setIsLoading(true);
      console.log('🔐 adminLogin: Starting login process...');
      
      // Call the real API
      const response = await fetch(API_ENDPOINTS.ADMIN.LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      const data = await response.json();
      console.log('🔐 adminLogin: Response status:', response.status, 'Data:', data);
      
      if (response.ok && data.success) {
        console.log('✅ adminLogin: Login successful, saving token to localStorage');
        localStorage.setItem('adminToken', data.token);
        console.log('✅ adminLogin: Token saved. Checking localStorage:', localStorage.getItem('adminToken') ? 'Token exists' : 'Token missing');
        
        setIsAdmin(true);
        setAdminUser(data.user);
        
        setIsLoading(false);
        return { success: true, message: data.message };
      } else {
        console.log('❌ adminLogin: Login failed:', data.message);
        setIsLoading(false);
        return { success: false, message: data.message || 'Login failed' };
      }
    } catch (error) {
      console.error('❌ adminLogin: Network error:', error);
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

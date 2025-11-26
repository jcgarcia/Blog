import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../config/api';

const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkUserAuth();
  }, []);

  const checkUserAuth = async () => {
    try {
      const token = localStorage.getItem('userToken');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch(API_ENDPOINTS.AUTH.VERIFY, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('userToken');
      }
    } catch (error) {
      console.error('User auth check failed:', error);
      localStorage.removeItem('userToken');
    } finally {
      setIsLoading(false);
    }
  };

  const userLogin = async (credentials) => {
    setIsLoading(true);
    try {
      console.log('UserContext: Attempting login with credentials:', credentials);
      console.log('UserContext: API endpoint:', API_ENDPOINTS.AUTH.LOGIN);
      
      const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      console.log('UserContext: Response status:', response.status);

      const data = await response.json();
      console.log('UserContext: Response data:', data);

      if (response.ok && data.success) {
        localStorage.setItem('userToken', data.token);
        setUser(data.user);
        setIsLoading(false);
        return { success: true, message: data.message };
      } else {
        setIsLoading(false);
        return { success: false, message: data.message || 'Login failed' };
      }
    } catch (error) {
      console.error('UserContext: Login failed:', error);
      setIsLoading(false);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  const loginWithCognito = async (authorizationCode) => {
    setIsLoading(true);
    try {
      const redirectUri = window.location.origin + '/auth/callback';
      console.log('UserContext: Attempting Cognito login with code:', authorizationCode);
      console.log('UserContext: Using redirect URI:', redirectUri);
      
      const response = await fetch(API_ENDPOINTS.AUTH.COGNITO_LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          code: authorizationCode,
          redirectUri: redirectUri
        })
      });

      console.log('UserContext: Cognito response status:', response.status);

      const data = await response.json();
      console.log('UserContext: Cognito response data:', data);

      if (response.ok && data.success) {
        localStorage.setItem('userToken', data.token);
        setUser(data.user);
        setIsLoading(false);
        return { success: true, message: data.message };
      } else {
        setIsLoading(false);
        return { success: false, message: data.message || 'Cognito login failed' };
      }
    } catch (error) {
      console.error('UserContext: Cognito login failed:', error);
      setIsLoading(false);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  const userLogout = () => {
    localStorage.removeItem('userToken');
    setUser(null);
  };

  const value = {
    user,
    isLoading,
    userLogin,
    loginWithCognito,
    userLogout,
    checkUserAuth
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};
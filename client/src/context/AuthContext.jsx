import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../services/authApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Bootstrap: re-validate stored token against the server on mount.
  // Keeps localStorage in sync with server truth (deactivated accounts, etc.)
  useEffect(() => {
    let isActive = true;
    const token = localStorage.getItem('token');

    if (!token) {
      setAuthReady(true);
      return () => { isActive = false; };
    }

    authService.getMe()
      .then((data) => {
        if (!isActive) return;
        authService.setAuthData(token, data.user);
        setUser(data.user);
      })
      .catch(() => {
        if (!isActive) return;
        authService.logout();
        setUser(null);
      })
      .finally(() => {
        if (isActive) setAuthReady(true);
      });

    return () => { isActive = false; };
  }, []);

  const login = (token, userData) => {
    authService.setAuthData(token, userData);
    setUser(userData);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, authReady, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

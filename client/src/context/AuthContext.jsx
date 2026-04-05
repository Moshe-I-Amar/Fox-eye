import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../services/authApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Bootstrap: validate session cookie against the server on mount.
  // If the HttpOnly cookie is present and valid, the server returns the user.
  useEffect(() => {
    let isActive = true;

    authService.getMe()
      .then((data) => {
        if (!isActive) return;
        authService.setAuthData(null, data.user);
        setUser(data.user);
      })
      .catch(() => {
        if (!isActive) return;
        localStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => {
        if (isActive) setAuthReady(true);
      });

    return () => { isActive = false; };
  }, []);

  const login = (userData) => {
    authService.setAuthData(null, userData);
    setUser(userData);
  };

  const logout = async () => {
    await authService.logout();
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

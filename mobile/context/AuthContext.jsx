import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../services/authApi';
import { storeToken, clearToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Bootstrap — check if a stored token is still valid
  useEffect(() => {
    (async () => {
      try {
        const { user: me } = await authApi.getMe();
        setUser(me);
      } catch {
        // Token missing or expired — stay logged out
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    // Backend returns token in body when X-Fox-Eye-Client: mobile header is set
    if (data.token) {
      await storeToken(data.token);
    }
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try { await authApi.logout(); } catch { /* noop */ }
    await clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, authReady, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

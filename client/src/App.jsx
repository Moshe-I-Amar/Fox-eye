import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AdminRoute from './components/layout/AdminRoute';
import AdminManagementRoute from './components/layout/AdminManagementRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import AdminManagement from './pages/AdminManagement';
import { authService } from './services/authApi';

function App() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let isActive = true;
    const token = localStorage.getItem('token');

    if (!token) {
      setAuthReady(true);
      return () => {
        isActive = false;
      };
    }

    const bootstrapAuth = async () => {
      try {
        const response = await authService.getMe();
        if (!isActive) return;
        authService.setAuthData(token, response.user);
      } catch (error) {
        authService.logout();
      } finally {
        if (isActive) {
          setAuthReady(true);
        }
      }
    };

    bootstrapAuth();

    return () => {
      isActive = false;
    };
  }, []);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gold">
        Loading session...
      </div>
    );
  }

  return (
    <div className="App">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/admin" element={
          <AdminRoute>
            <Admin />
          </AdminRoute>
        } />

        <Route path="/admin/management" element={
          <AdminManagementRoute>
            <AdminManagement />
          </AdminManagementRoute>
        } />
        
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}

export default App;

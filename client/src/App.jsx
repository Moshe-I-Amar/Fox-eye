import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import RouteGuard from './components/layout/RouteGuard';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import AdminManagement from './pages/AdminManagement';
import MobileFieldView from './pages/mobile/MobileFieldView';

const ADMIN_MANAGEMENT_ROLES = ['HQ', 'UNIT_COMMANDER', 'COMPANY_COMMANDER'];

// Inner component — can safely call useAuth() because it is rendered inside AuthProvider
const AppRoutes = () => {
  const { authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gold">
        Loading session...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/dashboard" element={
        <RouteGuard>
          <Dashboard />
        </RouteGuard>
      } />

      <Route path="/admin" element={
        <RouteGuard requireRole="admin">
          <Admin />
        </RouteGuard>
      } />

      <Route path="/admin/management" element={
        <RouteGuard requireRole="admin" requireOperationalRoles={ADMIN_MANAGEMENT_ROLES}>
          <AdminManagement />
        </RouteGuard>
      } />

      <Route path="/mobile" element={
        <RouteGuard requireRole="user">
          <MobileFieldView />
        </RouteGuard>
      } />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <AppRoutes />
      </div>
    </AuthProvider>
  );
}

export default App;

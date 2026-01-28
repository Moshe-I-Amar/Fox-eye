import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/authApi';

const AdminRoute = ({ children }) => {
  const location = useLocation();
  const user = authService.getCurrentUser();

  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
  }

  return children;
};

export default AdminRoute;
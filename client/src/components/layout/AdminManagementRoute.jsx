import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/authApi';

const allowedOperationalRoles = ['HQ', 'UNIT_COMMANDER'];

const AdminManagementRoute = ({ children }) => {
  const location = useLocation();
  const user = authService.getCurrentUser();

  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role !== 'admin' || !allowedOperationalRoles.includes(user?.operationalRole)) {
    return <Navigate to="/dashboard" state={{ from: location }} replace />;
  }

  return children;
};

export default AdminManagementRoute;

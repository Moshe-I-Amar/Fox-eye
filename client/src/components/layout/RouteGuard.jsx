import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Composable route guard.
 *
 * Props:
 *   requireRole             {string}   — user.role must equal this (e.g. 'admin')
 *   requireOperationalRoles {string[]} — user.operationalRole must be in this list
 *   fallback                {string}   — redirect target on role failure (default: '/dashboard')
 *
 * Reads auth state from AuthContext — reactive, no direct localStorage access.
 */
const RouteGuard = ({ children, requireRole, requireOperationalRoles, fallback = '/dashboard' }) => {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireRole && user?.role !== requireRole) {
    return <Navigate to={fallback} replace />;
  }

  if (requireOperationalRoles && !requireOperationalRoles.includes(user?.operationalRole)) {
    return <Navigate to={fallback} replace />;
  }

  return children;
};

export default RouteGuard;

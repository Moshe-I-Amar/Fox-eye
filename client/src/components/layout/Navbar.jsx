import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/authApi';
import Button from '../ui/Button';

const Navbar = ({ realtimeStatus = 'offline' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const isAuthPage = ['/login', '/register'].includes(location.pathname);

  if (isAuthPage) return null;

  const showLive = realtimeStatus === 'connected';
  const showReconnecting = realtimeStatus === 'reconnecting';

  return (
    <nav className="glass-card border-b border-gold/20 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-gold to-gold-light rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-jet" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-gold">GeoMap</span>
        </Link>

        <div className="flex items-center space-x-4">
          {(showLive || showReconnecting) && (
            <div
              className={`flex items-center space-x-2 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${
                showLive
                  ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.25)]'
                  : 'border-gold/40 bg-gold/10 text-gold/70'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  showLive ? 'bg-emerald-400' : 'bg-gold/70 animate-pulse'
                }`}
              />
              <span>{showLive ? 'LIVE' : 'Reconnecting...'}</span>
            </div>
          )}
          {user && (
            <>
              <span className="text-gold/80">
                Welcome, {user.name}
              </span>
              {user.role === 'admin' && (
                <Link to="/admin">
                  <Button variant="outline" size="small">
                    Admin
                  </Button>
                </Link>
              )}
              <Button onClick={handleLogout} variant="ghost" size="small">
                Logout
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

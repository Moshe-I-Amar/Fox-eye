import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authApi';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';

const REASON_NOTICES = {
  'session-expired': { message: 'Your session expired. Please sign in again.', tone: 'info' },
  'AUTH_PENDING':    { message: 'Your account is awaiting commander approval. Contact your commanding officer.', tone: 'warning' },
  'AUTH_REJECTED':   { message: 'Your account registration was rejected. Contact your commanding officer for assistance.', tone: 'error' },
  'AUTH_INACTIVE':   { message: 'Your account has been deactivated. Contact your commanding officer.', tone: 'error' },
};

const SUBMIT_ERROR_NOTICES = {
  'AUTH_PENDING':  { message: 'Your account is awaiting commander approval. You cannot sign in until it is approved.', tone: 'warning' },
  'AUTH_REJECTED': { message: 'Your account registration was rejected. Please contact your commanding officer.', tone: 'error' },
  'AUTH_INACTIVE': { message: 'Your account has been deactivated. Please contact your commanding officer.', tone: 'error' },
};

const NOTICE_STYLES = {
  info:    'bg-gold/15 border-gold/40 text-gold/90',
  warning: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  error:   'bg-red-500/20 border-red-500/50 text-red-300',
};

const Notice = ({ message, tone }) => (
  <div className={`border rounded-lg p-3 text-sm animate-slide-up ${NOTICE_STYLES[tone] || NOTICE_STYLES.error}`}>
    {message}
  </div>
);

const LoginLogo = () => (
  <div className="text-center mb-8">
    <div className="w-20 h-20 bg-gradient-to-r from-gold to-gold-light rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-gold-glow">
      <svg className="w-12 h-12 text-jet" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </div>
    <h1 className="text-3xl font-bold text-gold mb-2">Welcome Back</h1>
    <p className="text-gold/60">Sign in to your Fox-Eye account</p>
  </div>
);

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [submitNotice, setSubmitNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const urlNotice = useMemo(() => {
    const fromState = location.state?.message;
    if (fromState) return { message: fromState, tone: 'info' };
    const reason = new URLSearchParams(location.search).get('reason');
    return REASON_NOTICES[reason] || null;
  }, [location.search, location.state?.message]);

  const from = location.state?.from?.pathname || '/dashboard';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (submitNotice) setSubmitNotice(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSubmitNotice(null);
    try {
      const response = await authService.login(formData);
      login(response.user);
      navigate(from, { replace: true });
    } catch (error) {
      const code = error.response?.data?.error?.code;
      const message = error.response?.data?.error?.message || 'Login failed. Please try again.';
      setSubmitNotice(SUBMIT_ERROR_NOTICES[code] || { message, tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <LoginLogo />
        <Card glass goldBorder>
          <form onSubmit={handleSubmit} className="space-y-6">
            {urlNotice && <Notice {...urlNotice} />}
            {submitNotice && <Notice {...submitNotice} />}
            <Input type="email" name="email" label="Email Address" value={formData.email}
              onChange={handleChange} placeholder="Enter your email" disabled={loading} required />
            <Input type="password" name="password" label="Password" value={formData.password}
              onChange={handleChange} placeholder="Enter your password" disabled={loading} required />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-gold/60">
              Don't have an account?{' '}
              <Link to="/register" className="text-gold hover:text-gold-light transition-colors">Sign up</Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;

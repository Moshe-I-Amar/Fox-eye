import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authApi';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';

const Register = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();

  // Derive initial state from URL synchronously — eliminates the dead 'idle' arm
  const params = new URLSearchParams(location.search);
  const tokenParam = params.get('token');

  const [tokenStatus, setTokenStatus] = useState(tokenParam ? 'loading' : 'no-token');
  const [tokenData, setTokenData] = useState(null);
  const [inviteToken] = useState(tokenParam);

  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    if (!inviteToken) return;
    authService.validateInvite(inviteToken)
      .then((data) => {
        setTokenData(data);
        setTokenStatus('valid');
      })
      .catch(() => {
        setTokenStatus('invalid');
      });
  }, [inviteToken]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setSubmitLoading(true);
    setErrors({});
    try {
      const response = await authService.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        inviteToken
      });
      login(response.token, response.user);
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Registration failed';
      setErrors({ form: message });
    } finally {
      setSubmitLoading(false);
    }
  };

  const Logo = () => (
    <div className="text-center mb-8">
      <div className="w-20 h-20 bg-gradient-to-r from-gold to-gold-light rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-gold-glow">
        <svg className="w-12 h-12 text-jet" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-gold mb-2">Create Account</h1>
    </div>
  );

  if (tokenStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <Logo />
          <p className="text-gold/60">Validating invite link...</p>
        </div>
      </div>
    );
  }

  if (tokenStatus === 'no-token') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Logo />
          <Card glass goldBorder>
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 bg-gold/10 border border-gold/30 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-gold/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gold">Invite Required</h2>
              <p className="text-gold/60 text-sm">
                Registration requires an invite link from your commander.<br />
                Contact your commanding officer to receive an invite.
              </p>
              <Link to="/login" className="block mt-4 text-gold hover:text-gold-light transition-colors text-sm">
                Back to sign in
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (tokenStatus === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Logo />
          <Card glass goldBorder>
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-red-400">Invite Link Invalid</h2>
              <p className="text-gold/60 text-sm">
                This invite link is invalid or has expired.<br />
                Please request a new invite from your commanding officer.
              </p>
              <Link to="/login" className="block mt-4 text-gold hover:text-gold-light transition-colors text-sm">
                Back to sign in
              </Link>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // tokenStatus === 'valid'
  const expiresAt = new Date(tokenData.expiresAt);
  const hoursUntilExpiry = (expiresAt - Date.now()) / (1000 * 60 * 60);
  const isExpiringSoon = hoursUntilExpiry < 24;
  const expiryLabel = expiresAt.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Logo />

        <Card glass goldBorder>
          {/* Invited-by banner */}
          <div className="mb-6 p-3 rounded-lg bg-gold/10 border border-gold/30 flex items-center gap-3">
            <svg className="w-5 h-5 text-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div className="text-sm">
              <span className="text-gold/60">Invited by </span>
              <span className="text-gold font-medium">{tokenData.inviterName}</span>
            </div>
          </div>

          {/* Assignment + expiry (read-only) */}
          <div className="mb-6 p-3 rounded-lg border border-gold/20 bg-white/5 space-y-2">
            <p className="text-xs font-medium text-gold/50 uppercase tracking-wider">Your Assignment</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="text-gold/60">Unit: <span className="text-gold">{tokenData.unitName}</span></span>
              <span className="text-gold/60">Company: <span className="text-gold">{tokenData.companyName}</span></span>
              <span className="text-gold/60">Team: <span className="text-gold">{tokenData.teamName}</span></span>
              <span className="text-gold/60">Squad: <span className="text-gold">{tokenData.squadName}</span></span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gold/50">Role:</span>
              <span className="text-xs font-medium text-gold bg-gold/10 border border-gold/30 rounded px-2 py-0.5">
                {tokenData.assignedOperationalRole.replace(/_/g, ' ')}
              </span>
              {tokenData.assignedRole === 'admin' && (
                <span className="text-xs font-medium text-blue-300 bg-blue-500/10 border border-blue-500/30 rounded px-2 py-0.5">admin</span>
              )}
            </div>
            {/* Expiry row */}
            <div className={`flex items-center gap-1.5 text-xs mt-1 ${isExpiringSoon ? 'text-amber-400' : 'text-gold/40'}`}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {isExpiringSoon
                ? `Expires soon — ${expiryLabel}`
                : `Expires ${expiryLabel}`}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {errors.form && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm animate-slide-up">
                {errors.form}
              </div>
            )}

            <Input
              type="text"
              name="name"
              label="Full Name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              error={errors.name}
              disabled={submitLoading}
              required
            />

            <Input
              type="email"
              name="email"
              label="Email Address"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              error={errors.email}
              disabled={submitLoading}
              required
            />

            <Input
              type="password"
              name="password"
              label="Password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a password (min 6 characters)"
              error={errors.password}
              disabled={submitLoading}
              required
            />

            <Input
              type="password"
              name="confirmPassword"
              label="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              error={errors.confirmPassword}
              disabled={submitLoading}
              required
            />

            <Button type="submit" disabled={submitLoading} className="w-full">
              {submitLoading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gold/60">
              Already have an account?{' '}
              <Link to="/login" className="text-gold hover:text-gold-light transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Register;

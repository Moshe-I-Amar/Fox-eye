import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authApi';
import { hierarchyService } from '../services/hierarchyApi';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    unitId: '',
    companyId: '',
    teamId: '',
    squadId: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [hierarchy, setHierarchy] = useState({
    units: [],
    companies: [],
    teams: [],
    squads: []
  });
  const [hierarchyError, setHierarchyError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;
    const loadHierarchy = async () => {
      try {
        const data = await hierarchyService.getTree();
        if (!isActive) return;
        setHierarchy({
          units: data.units || [],
          companies: data.companies || [],
          teams: data.teams || [],
          squads: data.squads || []
        });
        setHierarchyError('');
      } catch (error) {
        if (!isActive) return;
        setHierarchyError('Unable to load hierarchy options. Please try again.');
      }
    };

    loadHierarchy();

    return () => {
      isActive = false;
    };
  }, []);

  const filteredCompanies = useMemo(
    () => hierarchy.companies.filter((company) => company.parentId === formData.unitId),
    [hierarchy.companies, formData.unitId]
  );

  const filteredTeams = useMemo(
    () => hierarchy.teams.filter((team) => team.parentId === formData.companyId),
    [hierarchy.teams, formData.companyId]
  );

  const filteredSquads = useMemo(
    () => hierarchy.squads.filter((squad) => squad.parentId === formData.teamId),
    [hierarchy.squads, formData.teamId]
  );

  useEffect(() => {
    if (!formData.unitId && hierarchy.units.length) {
      setFormData(prev => ({
        ...prev,
        unitId: hierarchy.units[0]._id
      }));
    }
  }, [formData.unitId, hierarchy.units]);

  useEffect(() => {
    if (filteredCompanies.length && !filteredCompanies.find((company) => company._id === formData.companyId)) {
      setFormData(prev => ({
        ...prev,
        companyId: filteredCompanies[0]._id,
        teamId: '',
        squadId: ''
      }));
    }
  }, [filteredCompanies, formData.companyId]);

  useEffect(() => {
    if (filteredTeams.length && !filteredTeams.find((team) => team._id === formData.teamId)) {
      setFormData(prev => ({
        ...prev,
        teamId: filteredTeams[0]._id,
        squadId: ''
      }));
    }
  }, [filteredTeams, formData.teamId]);

  useEffect(() => {
    if (filteredSquads.length && !filteredSquads.find((squad) => squad._id === formData.squadId)) {
      setFormData(prev => ({
        ...prev,
        squadId: filteredSquads[0]._id
      }));
    }
  }, [filteredSquads, formData.squadId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
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

    if (!formData.unitId) {
      newErrors.unitId = 'Unit selection is required';
    }
    if (!formData.companyId) {
      newErrors.companyId = 'Company selection is required';
    }
    if (!formData.teamId) {
      newErrors.teamId = 'Team selection is required';
    }
    if (!formData.squadId) {
      newErrors.squadId = 'Squad selection is required';
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

    setLoading(true);
    setErrors({});

    try {
      const { confirmPassword, ...registerData } = formData;
      const response = await authService.register(registerData);
      authService.setAuthData(response.token, response.user);
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.error?.message || 'Registration failed';
      setErrors({ form: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-gold to-gold-light rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-gold-glow">
            <svg className="w-12 h-12 text-jet" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gold mb-2">Create Account</h1>
          <p className="text-gold/60">Join GeoMap to share your location</p>
        </div>

        <Card glass goldBorder>
          <form onSubmit={handleSubmit} className="space-y-6">
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
              required
            />

            <Input
              type="password"
              name="password"
              label="Password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a password"
              error={errors.password}
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
              required
            />

            {hierarchyError && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300 text-sm animate-slide-up">
                {hierarchyError}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-gold">Unit</label>
              <select
                className="dark-input w-full"
                name="unitId"
                value={formData.unitId}
                onChange={(e) => {
                  const unitId = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    unitId,
                    companyId: '',
                    teamId: '',
                    squadId: ''
                  }));
                  if (errors.unitId) {
                    setErrors(prev => ({ ...prev, unitId: '' }));
                  }
                }}
                required
              >
                <option value="" disabled>Select unit</option>
                {hierarchy.units.map((unit) => (
                  <option key={unit._id} value={unit._id}>{unit.name}</option>
                ))}
              </select>
              {errors.unitId && <p className="text-xs text-red-400">{errors.unitId}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gold">Company</label>
              <select
                className="dark-input w-full"
                name="companyId"
                value={formData.companyId}
                onChange={(e) => {
                  const companyId = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    companyId,
                    teamId: '',
                    squadId: ''
                  }));
                  if (errors.companyId) {
                    setErrors(prev => ({ ...prev, companyId: '' }));
                  }
                }}
                required
              >
                <option value="" disabled>Select company</option>
                {filteredCompanies.map((company) => (
                  <option key={company._id} value={company._id}>{company.name}</option>
                ))}
              </select>
              {errors.companyId && <p className="text-xs text-red-400">{errors.companyId}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gold">Team</label>
              <select
                className="dark-input w-full"
                name="teamId"
                value={formData.teamId}
                onChange={(e) => {
                  const teamId = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    teamId,
                    squadId: ''
                  }));
                  if (errors.teamId) {
                    setErrors(prev => ({ ...prev, teamId: '' }));
                  }
                }}
                required
              >
                <option value="" disabled>Select team</option>
                {filteredTeams.map((team) => (
                  <option key={team._id} value={team._id}>{team.name}</option>
                ))}
              </select>
              {errors.teamId && <p className="text-xs text-red-400">{errors.teamId}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gold">Squad</label>
              <select
                className="dark-input w-full"
                name="squadId"
                value={formData.squadId}
                onChange={(e) => {
                  const squadId = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    squadId
                  }));
                  if (errors.squadId) {
                    setErrors(prev => ({ ...prev, squadId: '' }));
                  }
                }}
                required
              >
                <option value="" disabled>Select squad</option>
                {filteredSquads.map((squad) => (
                  <option key={squad._id} value={squad._id}>{squad.name}</option>
                ))}
              </select>
              {errors.squadId && <p className="text-xs text-red-400">{errors.squadId}</p>}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
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

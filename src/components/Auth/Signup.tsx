import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, Loader2, Lock, Mail, User as UserIcon, AlertCircle, CheckCircle2 } from 'lucide-react';

export const Signup: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const validateEmail = (val: string) => /\S+@\S+\.\S+/.test(val);

  const validate = () => {
    const errors: { [key: string]: string } = {};

    if (!fullName.trim()) {
      errors.fullName = 'Full name is required';
    }

    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!validateEmail(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters long';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setTopError(null);
    setSuccessMsg(null);

    if (isSubmitting) return;

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    const { error } = await signUp(fullName.trim(), email.trim(), password);
    setIsSubmitting(false);

    if (error) {
      let friendly = error;
      if (error.toLowerCase().includes('already registered') || error.toLowerCase().includes('already exists')) {
        friendly = 'An account with this email address already exists. Please log in instead.';
      } else if (error.toLowerCase().includes('weak password')) {
        friendly = 'Please choose a stronger password.';
      }
      setTopError(friendly);
    } else {
      setSuccessMsg('Account created successfully!');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen bg-background text-primary-text flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md space-y-8 animate-in fade-in duration-200">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-1.5 cursor-pointer" onClick={() => navigate('/login')}>
            <span className="text-3xl font-bold tracking-tight text-primary-text">equalli</span>
            <span className="w-2.5 h-2.5 rounded-full bg-accent mt-2"></span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-primary-text mt-4">
            Create an account
          </h1>
          <p className="text-sm text-secondary-text font-medium">
            Start tracking and splitting expenses effortlessly
          </p>
        </div>

        {/* Signup Form Card */}
        <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 shadow-xl">
          {topError && (
            <div className="mb-6 p-4 rounded-lg bg-negative/10 border border-negative/20 text-negative text-xs font-medium flex items-start space-x-3">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{topError}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 rounded-lg bg-accent/10 border border-accent/30 text-accent text-xs font-medium flex items-start space-x-3">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4" noValidate>
            {/* Full Name */}
            <div className="space-y-1.5">
              <label htmlFor="signup-name" className="block text-xs font-bold tracking-wider text-secondary-text uppercase">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-secondary-text">
                  <UserIcon size={18} />
                </div>
                <input
                  id="signup-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (fieldErrors.fullName) setFieldErrors(prev => ({ ...prev, fullName: '' }));
                  }}
                  placeholder="Khush Tatwavedi"
                  disabled={isSubmitting}
                  className={`w-full pl-10 pr-4 py-3 bg-elevated border rounded-lg text-sm text-primary-text placeholder-secondary-text/50 focus:outline-none transition-colors ${
                    fieldErrors.fullName ? 'border-negative' : 'border-border focus:border-accent'
                  }`}
                />
              </div>
              {fieldErrors.fullName && (
                <p className="text-[11px] text-negative font-medium pl-1">{fieldErrors.fullName}</p>
              )}
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <label htmlFor="signup-email" className="block text-xs font-bold tracking-wider text-secondary-text uppercase">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-secondary-text">
                  <Mail size={18} />
                </div>
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                  }}
                  placeholder="name@example.com"
                  disabled={isSubmitting}
                  className={`w-full pl-10 pr-4 py-3 bg-elevated border rounded-lg text-sm text-primary-text placeholder-secondary-text/50 focus:outline-none transition-colors ${
                    fieldErrors.email ? 'border-negative' : 'border-border focus:border-accent'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-[11px] text-negative font-medium pl-1">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="signup-password" className="block text-xs font-bold tracking-wider text-secondary-text uppercase">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-secondary-text">
                  <Lock size={18} />
                </div>
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                  }}
                  placeholder="At least 6 characters"
                  disabled={isSubmitting}
                  className={`w-full pl-10 pr-10 py-3 bg-elevated border rounded-lg text-sm text-primary-text placeholder-secondary-text/50 focus:outline-none transition-colors ${
                    fieldErrors.password ? 'border-negative' : 'border-border focus:border-accent'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-secondary-text hover:text-primary-text transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-[11px] text-negative font-medium pl-1">{fieldErrors.password}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label htmlFor="signup-confirm-password" className="block text-xs font-bold tracking-wider text-secondary-text uppercase">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-secondary-text">
                  <Lock size={18} />
                </div>
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) setFieldErrors(prev => ({ ...prev, confirmPassword: '' }));
                  }}
                  placeholder="Re-enter your password"
                  disabled={isSubmitting}
                  className={`w-full pl-10 pr-10 py-3 bg-elevated border rounded-lg text-sm text-primary-text placeholder-secondary-text/50 focus:outline-none transition-colors ${
                    fieldErrors.confirmPassword ? 'border-negative' : 'border-border focus:border-accent'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-secondary-text hover:text-primary-text transition-colors cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-[11px] text-negative font-medium pl-1">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 py-3 px-4 bg-accent hover:bg-accent/90 text-background font-bold text-sm rounded-lg transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Sign Up</span>
              )}
            </button>
          </form>

          {/* Footer Link to Login */}
          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-xs text-secondary-text">
              Already have an account?{' '}
              <Link to="/login" className="text-accent font-semibold hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;

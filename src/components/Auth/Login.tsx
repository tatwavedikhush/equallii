import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, Loader2, Lock, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Forgot password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const validateEmail = (val: string) => {
    return /\S+@\S+\.\S+/.test(val);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(trimmedEmail, password);
    setIsSubmitting(false);

    if (error) {
      // Map technical errors to user-friendly messages
      let friendly = error;
      if (error.toLowerCase().includes('invalid login credentials')) {
        friendly = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.toLowerCase().includes('email not confirmed')) {
        friendly = 'Your email is not verified yet. Please check your inbox for confirmation.';
      } else if (error.toLowerCase().includes('too many requests')) {
        friendly = 'Too many failed login attempts. Please wait a few moments and try again.';
      }
      setErrorMsg(friendly);
    } else {
      navigate('/', { replace: true });
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg(null);

    const trimmed = forgotEmail.trim();
    if (!trimmed || !validateEmail(trimmed)) {
      setForgotMsg({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setForgotSubmitting(true);
    const { error } = await resetPassword(trimmed);
    setForgotSubmitting(false);

    if (error) {
      setForgotMsg({ type: 'error', text: error });
    } else {
      setForgotMsg({
        type: 'success',
        text: 'Password reset link sent! Check your email inbox.'
      });
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
            Welcome back
          </h1>
          <p className="text-sm text-secondary-text font-medium">
            Sign in to manage your shared expenses
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface border border-border rounded-xl p-6 sm:p-8 shadow-xl">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-lg bg-negative/10 border border-negative/20 text-negative text-xs font-medium flex items-start space-x-3">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5" noValidate>
            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="login-email" className="block text-xs font-bold tracking-wider text-secondary-text uppercase">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-secondary-text">
                  <Mail size={18} />
                </div>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-3 bg-elevated border border-border rounded-lg text-sm text-primary-text placeholder-secondary-text/50 focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block text-xs font-bold tracking-wider text-secondary-text uppercase">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotMsg(null);
                    setIsForgotModalOpen(true);
                  }}
                  className="text-xs font-medium text-accent hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-secondary-text">
                  <Lock size={18} />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-10 py-3 bg-elevated border border-border rounded-lg text-sm text-primary-text placeholder-secondary-text/50 focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-secondary-text hover:text-primary-text transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 bg-accent hover:bg-accent/90 text-background font-bold text-sm rounded-lg transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Footer Link to Signup */}
          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-xs text-secondary-text">
              Don't have an account?{' '}
              <Link to="/signup" className="text-accent font-semibold hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-md p-6 space-y-6 animate-in zoom-in-95 duration-150">
            <div>
              <h2 className="text-xl font-bold text-primary-text">Reset Password</h2>
              <p className="text-xs text-secondary-text mt-1">
                Enter your registered email address to receive password reset instructions.
              </p>
            </div>

            {forgotMsg && (
              <div
                className={`p-3.5 rounded-lg border text-xs font-medium flex items-start space-x-2.5 ${
                  forgotMsg.type === 'success'
                    ? 'bg-accent/10 border-accent/30 text-accent'
                    : 'bg-negative/10 border-negative/20 text-negative'
                }`}
              >
                {forgotMsg.type === 'success' ? (
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                )}
                <span>{forgotMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold tracking-wider text-secondary-text uppercase">
                  Email Address
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@example.com"
                  disabled={forgotSubmitting}
                  className="w-full px-3.5 py-2.5 bg-elevated border border-border rounded-lg text-sm text-primary-text focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-secondary-text hover:text-primary-text transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  className="px-4 py-2 bg-accent hover:bg-accent/90 text-background font-bold text-xs rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {forgotSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Send Link</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;

/**
 * Register Page Component
 * Admin-style design with clean, modern aesthetics
 */

import React from 'react';
import { Loader2, Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { RegisterPageProps } from '../../../../shared/src/types/theme';

export function RegisterPage({
  isLoading,
  error,
  config,
  onSubmit,
  onOAuthClick,
  onNavigateToLogin,
}: RegisterPageProps) {
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [acceptTerms, setAcceptTerms] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.confirmPassword) {
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      return;
    }
    if (!acceptTerms) {
      return;
    }
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  const passwordsMatch = formData.password === formData.confirmPassword;
  const isFormValid =
    formData.firstName &&
    formData.lastName &&
    formData.email &&
    formData.password &&
    formData.confirmPassword &&
    passwordsMatch &&
    acceptTerms;

  const inputStyles = cn(
    'w-full pl-11 pr-4 py-3 rounded-xl border border-gray-100 dark:border-slate-700',
    'bg-gray-50/50 dark:bg-slate-800 text-sm font-bold text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500',
    'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400',
    'transition-all duration-150',
    'disabled:bg-gray-50 dark:disabled:bg-slate-800 disabled:cursor-not-allowed'
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-600 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-2xl">J</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">Create Account</h1>
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">NEW USER REGISTRATION</p>
        </div>

        {/* Register Form Card */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-1 bg-blue-600 rounded-full" />
              <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">ACCOUNT CREATION</h2>
            </div>
            <p className="text-[10px] font-medium text-gray-300 dark:text-gray-600 uppercase tracking-wider pl-3">
              FILL IN YOUR DETAILS
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Name Inputs - Side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label htmlFor="register-firstName" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">FIRST NAME</label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <input
                  id="register-firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="John"
                  className={inputStyles}
                  disabled={isLoading}
                  autoComplete="given-name"
                />
              </div>
            </div>
            <div className="space-y-3">
              <label htmlFor="register-lastName" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">LAST NAME</label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <input
                  id="register-lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Doe"
                  className={inputStyles}
                  disabled={isLoading}
                  autoComplete="family-name"
                />
              </div>
            </div>
          </div>

          {/* Email Input */}
          <div className="space-y-3">
            <label htmlFor="register-email" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">EMAIL INTERFACE</label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                id="register-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@example.com"
                className={inputStyles}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-3">
            <label htmlFor="register-password" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">SECURITY KEY</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className={cn(inputStyles, 'pr-11')}
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                disabled={isLoading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password Input */}
          <div className="space-y-3">
            <label htmlFor="register-confirmPassword" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">CONFIRM KEY</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                id="register-confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="••••••••"
                className={cn(
                  inputStyles,
                  'pr-11',
                  formData.confirmPassword && !passwordsMatch && 'border-red-300 dark:border-red-700 focus:ring-red-500/20 focus:border-red-500'
                )}
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-3.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                disabled={isLoading}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {formData.confirmPassword && !passwordsMatch && (
              <p className="text-xs text-red-600 dark:text-red-400 pl-3">PASSWORDS DO NOT MATCH</p>
            )}
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-start gap-3 pt-2">
            <input
              type="checkbox"
              id="terms"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
              disabled={isLoading}
            />
            <label htmlFor="terms" className="text-xs text-gray-500 dark:text-gray-400">
              I agree to the{' '}
              <a href="/terms" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">Terms of Service</a>{' '}
              and{' '}
              <a href="/privacy" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">Privacy Policy</a>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !isFormValid}
            className="w-full h-11 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 dark:shadow-none transition-all bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed mt-6 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                CREATING ACCOUNT...
              </>
            ) : (
              'CREATE ACCOUNT'
            )}
          </button>

          {/* Sign In Link */}
          <div className="text-center pt-6 border-t border-gray-50 dark:border-slate-700 mt-6">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
              ALREADY HAVE AN ACCOUNT?
            </p>
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold text-sm transition-colors"
              disabled={isLoading}
            >
              SIGN IN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

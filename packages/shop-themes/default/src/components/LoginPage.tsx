/**
 * Login Page Component
 * Supports email/password login and OAuth login
 * Uses @jiffoo/ui design system.
 */

import React from 'react';
import { Loader2, Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { LoginPageProps } from '../../../../shared/src/types/theme';
import { Button } from '../ui/Button';

export function LoginPage({
  isLoading,
  error,
  config,
  onSubmit,
  onOAuthClick,
  onNavigateToRegister,
  onNavigateToForgotPassword,
}: LoginPageProps) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  // Detect browser autofill via CSS animation trick
  const handleAutofill = (setter: (v: string) => void) => (e: React.AnimationEvent<HTMLInputElement>) => {
    if (e.animationName === 'onAutoFillStart') {
      setter(e.currentTarget.value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Read from DOM refs to handle browser autofill (autofill doesn't trigger onChange)
    const emailVal = emailRef.current?.value || email;
    const passwordVal = passwordRef.current?.value || password;
    if (!emailVal || !passwordVal) {
      return;
    }
    try {
      await onSubmit(emailVal, passwordVal);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  // Button is always clickable unless loading; handleSubmit validates from DOM refs

  const inputStyles = cn(
    'w-full pl-11 pr-4 py-3 rounded-xl border border-gray-100 dark:border-slate-700',
    'bg-gray-50/50 dark:bg-slate-900/50 text-sm font-bold text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500',
    'focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:border-blue-500 dark:focus:border-blue-400',
    'transition-all duration-150',
    'disabled:bg-gray-50 dark:disabled:bg-slate-900 disabled:cursor-not-allowed'
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-5 sm:mb-6">
          <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-2xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-xl sm:text-2xl">J</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">Welcome Back</h1>
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">AUTHENTICATION INTERFACE</p>
        </div>

        {/* Login Form Card */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8 space-y-5 sm:space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-1 bg-blue-600 dark:bg-blue-400 rounded-full" />
              <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">SYSTEM ACCESS</h2>
            </div>
            <p className="text-[10px] font-medium text-gray-300 dark:text-gray-600 uppercase tracking-wider pl-3">
              ENTER CREDENTIALS TO PROCEED
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Email Input */}
          <div className="space-y-3">
            <label htmlFor="login-email" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">
              EMAIL INTERFACE
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
              <input
                id="login-email"
                ref={emailRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onAnimationStart={handleAutofill(setEmail)}
                placeholder="you@example.com"
                className={inputStyles}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-3">
            <label htmlFor="login-password" className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block">
              SECURITY KEY
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
              <input
                id="login-password"
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onAnimationStart={handleAutofill(setPassword)}
                placeholder="••••••••"
                className={cn(inputStyles, 'pr-11')}
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                disabled={isLoading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 sm:h-11 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 dark:shadow-blue-900/30 transition-all bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed mt-5 sm:mt-6 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AUTHENTICATING...
              </>
            ) : (
              'AUTHENTICATE'
            )}
          </button>

          {/* Sign Up Link */}
          <div className="text-center pt-5 sm:pt-6 border-t border-gray-50 dark:border-slate-700 mt-5 sm:mt-6">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
              DON'T HAVE AN ACCOUNT?
            </p>
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold text-sm transition-colors"
              disabled={isLoading}
            >
              CREATE NEW ACCOUNT
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


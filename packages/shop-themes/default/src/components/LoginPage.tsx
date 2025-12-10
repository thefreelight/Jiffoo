/**
 * 登录页面组件
 * 支持邮箱密码登录和 OAuth 登录
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      return;
    }
    try {
      await onSubmit(email, password);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const inputStyles = cn(
    'w-full pl-11 pr-4 py-3 rounded-xl border border-neutral-200',
    'bg-white text-neutral-900 placeholder:text-neutral-400',
    'focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
    'transition-all duration-150',
    'disabled:bg-neutral-50 disabled:cursor-not-allowed'
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-neutral-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-brand-md">
            <span className="text-white font-bold text-2xl">J</span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Welcome Back</h1>
          <p className="text-neutral-500">Sign in to your account</p>
        </div>

        {/* Login Form Card */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl border border-neutral-100 p-8 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-error-50 border border-error-200 rounded-xl p-4">
              <p className="text-sm text-error-600">{error}</p>
            </div>
          )}

          {/* Email Input */}
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-neutral-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 h-5 w-5 text-neutral-400" />
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputStyles}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-neutral-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-5 w-5 text-neutral-400" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={cn(inputStyles, 'pr-11')}
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3.5 text-neutral-400 hover:text-neutral-600 transition-colors"
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

          {/* Forgot Password Link */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onNavigateToForgotPassword}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium transition-colors"
              disabled={isLoading}
            >
              Forgot password?
            </button>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full shadow-brand-sm"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-neutral-500">Or continue with</span>
            </div>
          </div>

          {/* OAuth Button */}
          <Button
            type="button"
            onClick={() => onOAuthClick('google')}
            variant="outline"
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

          {/* Sign Up Link */}
          <div className="text-center pt-2">
            <p className="text-sm text-neutral-500">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="text-brand-600 hover:text-brand-700 font-semibold transition-colors"
                disabled={isLoading}
              >
                Sign up
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}


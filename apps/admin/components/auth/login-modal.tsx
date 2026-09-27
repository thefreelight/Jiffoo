/**
 * Login Modal Component
 *
 * Modal dialog for user authentication with i18n support.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/lib/store';
import { useToast } from '@/components/ui/toast';
import { Eye, EyeOff, Lock, Mail, Loader2 } from 'lucide-react';
import { useT } from 'shared/src/i18n/react';
import { resolveApiErrorMessage } from '@/lib/error-utils';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const { login, isLoading } = useAuthStore();
  const { addToast } = useToast();
  const t = useT();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(getText('merchant.auth.enterBothFields', 'Please enter both email and password'));
      return;
    }

    try {
      await login(email, password);

      addToast({
        type: 'success',
        title: getText('merchant.auth.loginSuccess', 'Login Successful'),
        description: getText('merchant.auth.welcomeBack', 'Welcome back to your admin workspace!')
      });
      onClose();
      onSuccess?.();
    } catch (error: unknown) {
      const errorMessage = resolveApiErrorMessage(
        error,
        t,
        'merchant.auth.invalidCredentials',
        'Invalid email or password'
      );
      setError(errorMessage);
      addToast({
        type: 'error',
        title: getText('merchant.auth.loginFailed', 'Login Failed'),
        description: errorMessage
      });
    }
  };

  if (!isOpen) return null;

  const modalTitle = getText('merchant.auth.welcomeBackTitle', 'Welcome Back');
  const modalDescription = getText('merchant.auth.signInDescription', 'Sign in to access your commerce admin workspace');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-overlay-ink/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <Card className="relative w-full max-w-md mx-4 shadow-2xl border-0">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-action-base to-highlight-strong rounded-2xl flex items-center justify-center shadow-lg">
            <Lock className="w-8 h-8 text-surface" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">{modalTitle}</CardTitle>
            <CardDescription className="text-neutral-strong">
              {modalDescription}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Error Message */}
            {error && (
              <div className="bg-danger-veil border border-danger-soft text-danger-deep px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">{getText('merchant.auth.emailAddress', 'Email Address')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-light w-4 h-4" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={getText('merchant.auth.enterEmail', 'Enter your email')}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password">{getText('merchant.auth.password', 'Password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-light w-4 h-4" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={getText('merchant.auth.enterPassword', 'Enter your password')}
                  className="pl-10 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-light hover:text-neutral-strong"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-action-strong to-highlight-strong hover:from-action-deep hover:to-highlight-deep"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {getText('merchant.auth.signingIn', 'Signing In...')}
                </>
              ) : (
                getText('merchant.auth.signIn', 'Sign In')
              )}
            </Button>

            {/* Cancel Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onClose}
              disabled={isLoading}
            >
              {getText('common.cancel', 'Cancel')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

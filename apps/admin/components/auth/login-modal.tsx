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
import { useT } from 'shared/src/i18n';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('admin@jiffoo.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const { login, isLoading } = useAuthStore();
  const { addToast } = useToast();
  const t = useT();

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(getText('tenant.auth.enterBothFields', 'Please enter both email and password'));
      return;
    }

    try {
      await login(email, password);

      addToast({
        type: 'success',
        title: getText('tenant.auth.loginSuccess', 'Login Successful'),
        description: getText('tenant.auth.welcomeBack', 'Welcome back to Jiffoo Mall Admin!')
      });
      onClose();
      onSuccess?.();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : getText('tenant.auth.invalidCredentials', 'Invalid email or password. Please try again.');
      setError(errorMessage);
      addToast({
        type: 'error',
        title: getText('tenant.auth.loginFailed', 'Login Failed'),
        description: errorMessage
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <Card className="relative w-full max-w-md mx-4 shadow-2xl border-0">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">{getText('tenant.auth.welcomeBackTitle', 'Welcome Back')}</CardTitle>
            <CardDescription className="text-gray-600">
              {getText('tenant.auth.signInDescription', 'Sign in to access the Jiffoo Mall Admin Panel')}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Demo Credentials Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">{getText('tenant.auth.demoCredentials', 'Demo Credentials')}</h4>
              <div className="text-xs text-blue-700 space-y-1">
                <div><strong>{getText('tenant.auth.email', 'Email')}:</strong> admin@jiffoo.com</div>
                <div><strong>{getText('tenant.auth.password', 'Password')}:</strong> admin123</div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">{getText('tenant.auth.emailAddress', 'Email Address')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={getText('tenant.auth.enterEmail', 'Enter your email')}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password">{getText('tenant.auth.password', 'Password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={getText('tenant.auth.enterPassword', 'Enter your password')}
                  className="pl-10 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {getText('tenant.auth.signingIn', 'Signing In...')}
                </>
              ) : (
                getText('tenant.auth.signIn', 'Sign In')
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

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Mail, User, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../../../store/auth';
import { authApi } from '../../../../lib/api';
import { cn } from '../../../../lib/utils';

function RegisterContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'en';
  const nextUrl = searchParams.get('next');

  const { isAuthenticated, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(nextUrl ?? `/${locale}`);
    }
  }, [isAuthenticated, nextUrl, locale, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    clearError();

    if (!email || !username || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (username.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreeTerms) {
      setError('Please agree to the Terms and Privacy Policy to continue.');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.register({ email, username, password });
      router.replace(nextUrl ?? `/${locale}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-300">
      <div className="network-grid-bg opacity-50"></div>

      {/* Auth header */}
      <header className="flex items-center justify-between px-6 lg:px-10 h-16 border-b border-border flex-shrink-0 relative z-10">
        <button
          onClick={() => router.push(`/${locale}`)}
          className="font-mono font-bold text-base uppercase tracking-tighter text-foreground hover:text-muted-foreground transition-colors"
        >
          YEVBI
        </button>
        <button
          onClick={() => router.push(`/${locale}`)}
          className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Shop
        </button>
      </header>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-4 pt-10 pb-20 relative z-10">
        <div className="w-full max-w-sm">

          {/* Title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground uppercase tracking-tight leading-none mb-2">
              Create Account
            </h1>
            <p className="text-sm text-muted-foreground">Join YEVBI</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">

            {/* Email */}
            <div>
              <label htmlFor="email" className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground/40">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  className="w-full h-11 pl-10 pr-4 bg-muted border border-border text-foreground text-sm placeholder-muted-foreground/20 focus:outline-none focus:border-foreground transition-colors"
                  required
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground/40">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your username"
                  autoComplete="username"
                  className="w-full h-11 pl-10 pr-4 bg-muted border border-border text-foreground text-sm placeholder-muted-foreground/20 focus:outline-none focus:border-foreground transition-colors"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground/40">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  className="w-full h-11 pl-10 pr-11 bg-muted border border-border text-foreground text-sm placeholder-muted-foreground/20 focus:outline-none focus:border-foreground transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground/40 hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground/40">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  className="w-full h-11 pl-10 pr-11 bg-muted border border-border text-foreground text-sm placeholder-muted-foreground/20 focus:outline-none focus:border-foreground transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground/40 hover:text-foreground transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Terms agreement */}
            <div className="flex items-start gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setAgreeTerms(!agreeTerms)}
                className={cn(
                  'w-4 h-4 border flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                  agreeTerms
                    ? 'bg-foreground border-foreground'
                    : 'bg-transparent border-border hover:border-muted-foreground'
                )}
              >
                {agreeTerms && (
                  <svg className="w-2.5 h-2.5 text-background" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
              <p className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none font-mono uppercase tracking-widest text-[10px]" onClick={() => setAgreeTerms(!agreeTerms)}>
                I agree to the{' '}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); router.push(`/${locale}/terms`); }}
                  className="text-foreground hover:underline underline-offset-4"
                >
                  Terms
                </button>
                {' '}and{' '}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); router.push(`/${locale}/privacy`); }}
                  className="text-foreground hover:underline underline-offset-4"
                >
                  Privacy Policy
                </button>
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-destructive/10 border border-destructive/20 transition-colors duration-300">
                <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                <p className="text-[11px] text-destructive font-mono uppercase tracking-widest">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-primary text-primary-foreground font-mono text-xs uppercase tracking-widest hover:bg-muted hover:text-foreground active:scale-[0.99] border border-primary hover:border-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
            >
              {isLoading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating account...</>
              ) : (
                'Create Account'
              )}
            </button>

          </form>

          {/* Sign in link */}
          <div className="mt-6 text-center transition-colors duration-300">
            <p className="text-xs text-muted-foreground">
              Already have an account?{' '}
              <button
                onClick={() => router.push(`/${locale}/auth/login${nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : ''}`)}
                className="text-foreground hover:underline underline-offset-4 transition-colors"
              >
                Sign in
              </button>
            </p>
          </div>

        </div>
      </div>

      {/* Bottom footer */}
      <footer className="flex items-center justify-center gap-5 px-6 h-12 border-t border-border flex-shrink-0 relative z-10 transition-colors duration-300">
        <button
          onClick={() => router.push(`/${locale}/terms`)}
          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          Terms
        </button>
        <span className="text-border">·</span>
        <button
          onClick={() => router.push(`/${locale}/privacy`)}
          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          Privacy
        </button>
      </footer>

    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}

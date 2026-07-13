'use client';

import { useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Mail, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

function ForgotPasswordContent() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    setIsLoading(true);
    try {
      // Simulate API call — replace with actual reset endpoint when available
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSubmitted(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
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

          {submitted ? (
            /* Success state */
            <div className="text-center">
              <div className="w-12 h-12 border border-border flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-5 h-5 text-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground uppercase tracking-tight leading-none mb-2">
                Check Your Email
              </h1>
              <p className="text-sm text-muted-foreground mb-2">
                We&apos;ve sent a password reset link to
              </p>
              <p className="text-sm text-foreground font-mono mb-8 truncate">
                {email}
              </p>
              <p className="text-xs text-muted-foreground/40 mb-8 leading-relaxed font-mono uppercase tracking-widest text-[10px]">
                Didn&apos;t receive it? Check your spam folder, or{' '}
                <button
                  onClick={() => setSubmitted(false)}
                  className="text-muted-foreground hover:text-foreground hover:underline underline-offset-4 transition-colors"
                >
                  try again
                </button>
                .
              </p>
              <button
                onClick={() => router.push(`/${locale}/auth/login`)}
                className="w-full h-11 bg-primary text-primary-foreground font-mono text-xs uppercase tracking-widest hover:bg-muted hover:text-foreground active:scale-[0.99] border border-primary hover:border-foreground transition-all flex items-center justify-center"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="mb-8 font-mono">
                <h1 className="text-2xl font-bold text-foreground uppercase tracking-tight leading-none mb-2">
                  Forgot Password
                </h1>
                <p className="text-sm text-muted-foreground">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">

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
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>

              </form>

              {/* Back to sign in */}
              <div className="mt-6 text-center transition-colors duration-300">
                <p className="text-xs text-muted-foreground">
                  Remember your password?{' '}
                  <button
                    onClick={() => router.push(`/${locale}/auth/login`)}
                    className="text-foreground hover:underline underline-offset-4 transition-colors"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </>
          )}

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

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  );
}

'use client';

import {
  ArrowRight,
  Clock3,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { LoginPageProps } from 'shared/src/types/theme';

import { featuredCards, recentCreations, templateCards, type CreativeCard } from '../site';
import { StudioMain, StudioPage } from './StudioShell';

const loginPreviewCards: CreativeCard[] = [
  featuredCards[0],
  templateCards[1],
  recentCreations[1],
].filter((card): card is CreativeCard => Boolean(card));

const loginBenefits = [
  {
    title: 'Private generations',
    body: 'Keep source files, prompts, and generated results in your own workspace.',
    icon: ShieldCheck,
  },
  {
    title: 'Prompt continuity',
    body: 'Return to earlier visual directions instead of rebuilding from memory.',
    icon: WandSparkles,
  },
  {
    title: 'Faster iteration',
    body: 'Move from idea to polished image without losing the creative thread.',
    icon: Clock3,
  },
];

export function LoginPage({
  isLoading,
  error,
  onSubmit,
  onNavigateToRegister,
  onNavigateToForgotPassword,
}: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      return;
    }
    await onSubmit(email.trim(), password);
  }

  return (
    <StudioPage activeNav="assets" className="imagic-auth-shell">
      <StudioMain className="imagic-auth-main">
        <div className="imagic-auth-layout">
          <section className="imagic-auth-showcase" aria-label="imagic workspace preview">
            <div className="imagic-auth-copy">
              <p className="imagic-auth-eyebrow">image + magic = imagic</p>
              <h1>Your creative room remembers every spark.</h1>
              <p>
                Log in to keep prompts, assets, and generation history connected across every visual pass.
              </p>
            </div>

            <div className="imagic-auth-preview" aria-hidden="true">
              <div className="imagic-auth-preview-main">
                <img src={loginPreviewCards[0]?.image} alt="" />
                <div>
                  <span>Last render</span>
                  <strong>{loginPreviewCards[0]?.title || 'Visual pass'}</strong>
                </div>
              </div>
              <div className="imagic-auth-preview-stack">
                {loginPreviewCards.slice(1).map((card) => (
                  <img key={card.id} src={card.image} alt="" />
                ))}
              </div>
              <div className="imagic-auth-floating-card">
                <Sparkles className="h-4 w-4" />
                <span>Prompt saved</span>
                <strong>soft light · poster-ready · 16:9</strong>
              </div>
            </div>

            <div className="imagic-auth-benefits">
              {loginBenefits.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <article key={benefit.title}>
                    <Icon className="h-5 w-5" />
                    <h2>{benefit.title}</h2>
                    <p>{benefit.body}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <form onSubmit={handleSubmit} className="imagic-auth-card">
            <p className="imagic-auth-card-kicker">Workspace access</p>
            <h2>Welcome back.</h2>
            <p className="imagic-auth-card-copy">Use your email and password to continue into the creator workspace.</p>

            {error ? (
              <div className="imagic-form-error">{error}</div>
            ) : null}

            <div className="imagic-auth-fields">
              <label>
                <span>Email</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--imagic-muted)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="creator@studio.com"
                    className="imagic-auth-input pl-11 pr-4"
                    autoComplete="email"
                  />
                </div>
              </label>

              <label>
                <span>Password</span>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--imagic-muted)]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="imagic-auth-input pl-11 pr-11"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--imagic-muted)]">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            </div>

            <button type="submit" disabled={isLoading} className="imagic-auth-submit">
              {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>

            <button type="button" disabled className="imagic-auth-secondary">
              Google sign-in soon
            </button>

            <div className="imagic-auth-links">
              <button type="button" onClick={onNavigateToForgotPassword}>
                Forgot password?
              </button>
              <button type="button" onClick={onNavigateToRegister}>
                Create account
              </button>
            </div>
          </form>
        </div>
      </StudioMain>
    </StudioPage>
  );
}

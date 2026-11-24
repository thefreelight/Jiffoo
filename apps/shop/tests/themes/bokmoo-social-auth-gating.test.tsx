import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LoginPageProps, RegisterPageProps } from 'shared/src/types/theme';
import { LoginPage } from '@shop-themes/bokmoo/src/components/LoginPage';
import { RegisterPage } from '@shop-themes/bokmoo/src/components/RegisterPage';
import { readySocialProviders } from '@shop-themes/bokmoo/src/components/SocialAuthButtons';

/**
 * Every social button used to render unconditionally. On an instance with no
 * provider configured the login page showed three buttons that could only
 * answer "login is not configured", which reads as a broken page.
 */
const SOCIAL_BUTTONS = ['Google', 'Apple', 'Facebook'];

const handlers = {
  isLoading: false,
  onOAuthClick: vi.fn(async () => undefined),
  onAppleOAuthClick: vi.fn(async () => undefined),
  onFacebookOAuthClick: vi.fn(async () => undefined),
};

function renderLoginPage(status: LoginPageProps['socialAuthStatus']) {
  return render(
    <LoginPage
      {...handlers}
      socialAuthStatus={status}
      onSubmit={vi.fn(async () => undefined)}
      onNavigateToRegister={vi.fn()}
      onNavigateToForgotPassword={vi.fn()}
    />,
  );
}

function renderRegisterPage(status: RegisterPageProps['socialAuthStatus']) {
  return render(
    <RegisterPage
      {...handlers}
      socialAuthStatus={status}
      onSubmit={vi.fn(async () => undefined)}
      onNavigateToLogin={vi.fn()}
    />,
  );
}

function visibleSocialButtons(): string[] {
  return SOCIAL_BUTTONS.filter((name) => screen.queryByRole('button', { name }) !== null);
}

describe('bokmoo social sign-in gating', () => {
  describe('readySocialProviders', () => {
    const wired = { google: true, apple: true, facebook: true };

    it('renders nothing while the provider probe is in flight', () => {
      expect(readySocialProviders({ google: true, isLoading: true }, wired)).toEqual([]);
    });

    it('keeps only the providers the host reported as configured', () => {
      expect(readySocialProviders({ google: true, apple: false, facebook: false }, wired)).toEqual(['google']);
      expect(readySocialProviders({ google: false, apple: false, facebook: false }, wired)).toEqual([]);
    });

    it('drops a provider whose entry point is not wired', () => {
      expect(readySocialProviders({ apple: true }, { google: true })).toEqual([]);
    });

    it('falls back to the wired entry points when the host reports no status', () => {
      expect(readySocialProviders(undefined, wired)).toEqual(['google', 'apple', 'facebook']);
      expect(readySocialProviders(undefined, { google: true })).toEqual(['google']);
    });
  });

  describe('login page', () => {
    it('shows no social buttons and no "or email" divider when nothing is configured', () => {
      renderLoginPage({ google: false, apple: false, facebook: false, isLoading: false });

      expect(visibleSocialButtons()).toEqual([]);
      expect(screen.queryByText('or email')).toBeNull();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('shows no social buttons before the probe answers', () => {
      renderLoginPage({ isLoading: true });

      expect(visibleSocialButtons()).toEqual([]);
    });

    it('shows only the configured provider', () => {
      renderLoginPage({ google: true, apple: false, facebook: false, isLoading: false });

      expect(visibleSocialButtons()).toEqual(['Google']);
      expect(screen.getByText('or email')).toBeInTheDocument();
    });

    it('shows every provider when all three are configured', () => {
      renderLoginPage({ google: true, apple: true, facebook: true, isLoading: false });

      expect(visibleSocialButtons()).toEqual(['Google', 'Apple', 'Facebook']);
    });
  });

  describe('register page', () => {
    it('shows no social buttons when nothing is configured', () => {
      renderRegisterPage({ google: false, apple: false, facebook: false, isLoading: false });

      expect(visibleSocialButtons()).toEqual([]);
      expect(screen.queryByText('or email')).toBeNull();
    });

    it('shows only the configured provider', () => {
      renderRegisterPage({ google: false, apple: true, facebook: true, isLoading: false });

      expect(visibleSocialButtons()).toEqual(['Apple', 'Facebook']);
      expect(screen.getByText('or email')).toBeInTheDocument();
    });
  });
});

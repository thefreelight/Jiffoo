import React from 'react';
import { ArrowLeft, LockKeyhole, Save, UserRound } from 'lucide-react';
import type { ProfileSettingsPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';

export const ProfileSettingsPage = React.memo(function ProfileSettingsPage({
  user,
  isLoading,
  isAuthenticated,
  locale,
  config,
  onSaveProfile,
  onChangePassword,
  onNavigateBack,
  onNavigateToLogin,
}: ProfileSettingsPageProps) {
  const copy = getNavCopy(locale);
  const [profile, setProfile] = React.useState({
    name: user?.name || '',
    phone: user?.phone || '',
    dateOfBirth: user?.dateOfBirth || '',
    gender: user?.gender || 'OTHER',
    preferredLanguage: user?.preferredLanguage || copy.locale,
    timezone: user?.timezone || 'UTC',
  });
  const [password, setPassword] = React.useState({
    currentPassword: '',
    newPassword: '',
  });
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [savingPassword, setSavingPassword] = React.useState(false);

  React.useEffect(() => {
    setProfile({
      name: user?.name || '',
      phone: user?.phone || '',
      dateOfBirth: user?.dateOfBirth || '',
      gender: user?.gender || 'OTHER',
      preferredLanguage: user?.preferredLanguage || copy.locale,
      timezone: user?.timezone || 'UTC',
    });
  }, [copy.locale, user]);

  if (isLoading) {
    return (
      <MarketplaceFrame locale={locale} config={config}>
        <div className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-10 text-center text-[var(--navtoai-copy)]">
          {copy.common.loading}
        </div>
      </MarketplaceFrame>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <MarketplaceFrame locale={locale} config={config}>
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="max-w-lg rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-10 text-center shadow-[var(--navtoai-shadow-sm)]">
            <h1 className="text-[2rem] font-black tracking-[-0.05em] text-[var(--navtoai-ink)]">
              {copy.profile.signInTitle}
            </h1>
            <button
              onClick={onNavigateToLogin}
              className="mt-6 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-6 py-3 text-sm font-semibold text-white"
              type="button"
            >
              {copy.profile.signInCta}
            </button>
          </div>
        </div>
      </MarketplaceFrame>
    );
  }

  return (
    <MarketplaceFrame locale={locale} config={config}>
      <div className="space-y-6">
        <button
          onClick={onNavigateBack}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--navtoai-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--navtoai-copy)] shadow-[var(--navtoai-shadow-xs)]"
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          {copy.profile.back}
        </button>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-sm)] sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--navtoai-primary-soft)] text-[var(--navtoai-primary)]">
                <UserRound className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy-soft)]">
                  {copy.profile.profileEyebrow}
                </p>
                <h1 className="mt-2 text-3xl font-black leading-[1.04] tracking-[-0.04em] text-[var(--navtoai-ink)]">
                  {copy.profile.profileTitle}
                </h1>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy-soft)]">
                  {copy.profile.email}
                </span>
                <input
                  value={user.email}
                  readOnly
                  className="h-12 rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] px-4 text-sm text-[var(--navtoai-copy)] outline-none"
                />
              </label>
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy-soft)]">
                  {copy.profile.name}
                </span>
                <input
                  value={profile.name}
                  onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
                  className="h-12 rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] px-4 text-sm text-[var(--navtoai-ink)] outline-none"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy-soft)]">
                  {copy.profile.phone}
                </span>
                <input
                  value={profile.phone}
                  onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
                  className="h-12 rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] px-4 text-sm text-[var(--navtoai-ink)] outline-none"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy-soft)]">
                  {copy.profile.dateOfBirth}
                </span>
                <input
                  value={profile.dateOfBirth}
                  onChange={(event) => setProfile((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
                  className="h-12 rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] px-4 text-sm text-[var(--navtoai-ink)] outline-none"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy-soft)]">
                  {copy.profile.preferredLanguage}
                </span>
                <select
                  value={profile.preferredLanguage}
                  onChange={(event) =>
                    setProfile((prev) => ({ ...prev, preferredLanguage: event.target.value }))
                  }
                  className="h-12 rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] px-4 text-sm text-[var(--navtoai-ink)] outline-none"
                >
                  <option value="en">English</option>
                  <option value="zh-Hans">简体中文</option>
                  <option value="zh-Hant">繁體中文</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy-soft)]">
                  {copy.profile.timezone}
                </span>
                <input
                  value={profile.timezone}
                  onChange={(event) => setProfile((prev) => ({ ...prev, timezone: event.target.value }))}
                  className="h-12 rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] px-4 text-sm text-[var(--navtoai-ink)] outline-none"
                />
              </label>
            </div>

            <button
              onClick={async () => {
                setSavingProfile(true);
                try {
                  await onSaveProfile(profile);
                } finally {
                  setSavingProfile(false);
                }
              }}
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-5 text-sm font-semibold text-white"
              disabled={savingProfile}
              type="button"
            >
              <Save className="h-4 w-4" />
              {savingProfile ? copy.profile.savingProfile : copy.profile.saveProfile}
            </button>
          </section>

          <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-sm)] sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--navtoai-primary-soft)] text-[var(--navtoai-primary)]">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy-soft)]">
                  {copy.profile.securityEyebrow}
                </p>
                <h2 className="mt-2 text-3xl font-black leading-[1.04] tracking-[-0.04em] text-[var(--navtoai-ink)]">
                  {copy.profile.securityTitle}
                </h2>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy-soft)]">
                  {copy.profile.currentPassword}
                </span>
                <input
                  type="password"
                  value={password.currentPassword}
                  onChange={(event) =>
                    setPassword((prev) => ({ ...prev, currentPassword: event.target.value }))
                  }
                  className="h-12 rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] px-4 text-sm text-[var(--navtoai-ink)] outline-none"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--navtoai-copy-soft)]">
                  {copy.profile.newPassword}
                </span>
                <input
                  type="password"
                  value={password.newPassword}
                  onChange={(event) => setPassword((prev) => ({ ...prev, newPassword: event.target.value }))}
                  className="h-12 rounded-[1rem] border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] px-4 text-sm text-[var(--navtoai-ink)] outline-none"
                />
              </label>
            </div>

            <button
              onClick={async () => {
                setSavingPassword(true);
                try {
                  await onChangePassword(password.currentPassword, password.newPassword);
                  setPassword({ currentPassword: '', newPassword: '' });
                } finally {
                  setSavingPassword(false);
                }
              }}
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--navtoai-line)] bg-[var(--navtoai-bg-alt)] px-5 text-sm font-semibold text-[var(--navtoai-ink)]"
              disabled={savingPassword}
              type="button"
            >
              <LockKeyhole className="h-4 w-4 text-[var(--navtoai-primary)]" />
              {savingPassword ? copy.profile.updatingPassword : copy.profile.changePassword}
            </button>
          </section>
        </div>
      </div>
    </MarketplaceFrame>
  );
});

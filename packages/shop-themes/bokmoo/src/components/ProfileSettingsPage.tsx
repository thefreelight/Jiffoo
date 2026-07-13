import React from 'react';
import { ArrowLeft, LockKeyhole, Save, UserRound } from 'lucide-react';
import type { ProfileSettingsPageProps } from 'shared/src/types/theme';

export const ProfileSettingsPage = React.memo(function ProfileSettingsPage({
  user,
  isLoading,
  isAuthenticated,
  onSaveProfile,
  onChangePassword,
  onNavigateBack,
  onNavigateToLogin,
}: ProfileSettingsPageProps) {
  const [profile, setProfile] = React.useState({
    name: user?.name || '',
    phone: user?.phone || '',
    dateOfBirth: user?.dateOfBirth || '',
    gender: user?.gender || 'OTHER',
    preferredLanguage: user?.preferredLanguage || 'en',
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
      preferredLanguage: user?.preferredLanguage || 'en',
      timezone: user?.timezone || 'UTC',
    });
  }, [user]);

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--bokmoo-bg)]" />;
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bokmoo-bg)] px-4">
        <div className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-10 text-center shadow-[var(--bokmoo-shadow)]">
          <h1 className="text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]">Sign in to manage your account</h1>
          <button
            onClick={onNavigateToLogin}
            className="mt-6 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]"
            type="button"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1080px]">
        <button
          onClick={onNavigateBack}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]"
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]">
                <UserRound className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                  Traveler profile
                </p>
                <h1 className="mt-2 text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                  Keep your Bokmoo account ready for the next trip.
                </h1>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Email</span>
                <input value={user.email} readOnly className="h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-copy)] outline-none" />
              </label>
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Name</span>
                <input value={profile.name} onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Phone</span>
                <input value={profile.phone} onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Date of birth</span>
                <input value={profile.dateOfBirth} onChange={(event) => setProfile((prev) => ({ ...prev, dateOfBirth: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Language</span>
                <input value={profile.preferredLanguage} onChange={(event) => setProfile((prev) => ({ ...prev, preferredLanguage: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Timezone</span>
                <input value={profile.timezone} onChange={(event) => setProfile((prev) => ({ ...prev, timezone: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
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
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--bokmoo-gold)_82%,white),color-mix(in_oklab,var(--bokmoo-gold)_65%,black))] px-5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-bg)]"
              disabled={savingProfile}
              type="button"
            >
              <Save className="h-4 w-4" />
              {savingProfile ? 'Saving...' : 'Save profile'}
            </button>
          </section>

          <section className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                  Password
                </p>
                <h2 className="mt-2 text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                  Keep access secure between trips.
                </h2>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Current password</span>
                <input type="password" value={password.currentPassword} onChange={(event) => setPassword((prev) => ({ ...prev, currentPassword: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">New password</span>
                <input type="password" value={password.newPassword} onChange={(event) => setPassword((prev) => ({ ...prev, newPassword: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
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
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--bokmoo-line-strong)] bg-[var(--bokmoo-bg)] px-5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-ink)]"
              disabled={savingPassword}
              type="button"
            >
              <LockKeyhole className="h-4 w-4 text-[var(--bokmoo-gold)]" />
              {savingPassword ? 'Updating...' : 'Change password'}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
});

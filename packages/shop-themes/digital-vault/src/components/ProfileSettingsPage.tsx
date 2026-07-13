import React from 'react';
import { ArrowLeft, Lock, Save, UserCircle2 } from 'lucide-react';
import type { ProfileSettingsPageProps } from '../types/theme';

export const ProfileSettingsPage = React.memo(function ProfileSettingsPage({
  user,
  isLoading,
  isAuthenticated,
  onSaveProfile,
  onChangePassword,
  onNavigateBack,
  onNavigateToLogin,
}: ProfileSettingsPageProps) {
  const [profileForm, setProfileForm] = React.useState({
    name: user?.name || '',
    phone: user?.phone || '',
    preferredLanguage: user?.preferredLanguage || '',
    timezone: user?.timezone || '',
  });
  const [passwordForm, setPasswordForm] = React.useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [savingPassword, setSavingPassword] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      phone: user?.phone || '',
      preferredLanguage: user?.preferredLanguage || '',
      timezone: user?.timezone || '',
    });
  }, [user]);

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--vault-bg)]" />;
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[720px] rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-10 text-center shadow-[var(--vault-shadow-soft)]">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
            <UserCircle2 className="h-10 w-10" />
          </div>
          <h1 className="mt-6 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
            Sign in to edit account settings.
          </h1>
          <button
            onClick={onNavigateToLogin}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[var(--vault-primary)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)]"
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  const submitProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await onSaveProfile({
        name: profileForm.name.trim() || undefined,
        phone: profileForm.phone.trim() || undefined,
        preferredLanguage: profileForm.preferredLanguage.trim() || undefined,
        timezone: profileForm.timezone.trim() || undefined,
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!passwordForm.newPassword.trim()) {
      setPasswordError('New password is required');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordError(null);
    setSavingPassword(true);
    try {
      await onChangePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1080px] space-y-6">
        <button
          onClick={onNavigateBack}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-2.5 text-sm font-medium text-[var(--vault-copy)] transition-colors hover:bg-[var(--vault-primary-soft)] hover:text-[var(--vault-ink)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to account center
        </button>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
          <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)] sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                <UserCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                  Profile
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                  Keep account details current.
                </h1>
                <p className="mt-3 text-sm leading-6 text-[var(--vault-copy)]">
                  Update the buyer profile used across orders, delivery communication, and account-center preferences.
                </p>
              </div>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={submitProfile}>
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                  Email
                </label>
                <input
                  disabled
                  value={user.email}
                  className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface-alt)] px-4 text-sm text-[var(--vault-copy)] outline-none"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                  Display name
                </label>
                <input
                  value={profileForm.name}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                  Phone
                </label>
                <input
                  value={profileForm.phone}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Preferred language
                  </label>
                  <input
                    value={profileForm.preferredLanguage}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, preferredLanguage: event.target.value }))}
                    className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
                    placeholder="en / zh-Hant"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                    Timezone
                  </label>
                  <input
                    value={profileForm.timezone}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, timezone: event.target.value }))}
                    className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
                    placeholder="Asia/Hong_Kong"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--vault-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)] disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingProfile ? 'Saving...' : 'Save profile'}
              </button>
            </form>
          </section>

          <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)] sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                  Security
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                  Rotate account credentials safely.
                </h2>
                <p className="mt-3 text-sm leading-6 text-[var(--vault-copy)]">
                  Password changes should be deliberate. Use the current password to confirm the update and keep order-center access protected.
                </p>
              </div>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={submitPassword}>
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                  Current password
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                  New password
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
                />
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                  className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
                />
              </div>

              {passwordError ? (
                <p className="text-sm text-[var(--vault-danger)]">{passwordError}</p>
              ) : null}

              <button
                type="submit"
                disabled={savingPassword}
                className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--vault-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)] disabled:opacity-50"
              >
                <Lock className="h-4 w-4" />
                {savingPassword ? 'Updating...' : 'Change password'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
});

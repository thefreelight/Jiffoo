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
    return <div className="modelsfind-shell min-h-screen" />;
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="modelsfind-shell flex min-h-screen items-center justify-center px-4 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
        <div className="rounded-[2rem] border border-[var(--modelsfind-line)] bg-[rgba(18,14,20,0.92)] p-10 text-center shadow-[var(--modelsfind-card-shadow)]">
          <h1 className="[font-family:var(--modelsfind-display)] text-4xl tracking-[-0.05em] text-[var(--modelsfind-ink)]">
            Sign in to manage your private archive account
          </h1>
          <button
            type="button"
            onClick={onNavigateToLogin}
            className="mt-6 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_78%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modelsfind-shell min-h-screen px-4 pb-24 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8">
      <div className="mx-auto max-w-[1040px]">
        <button
          type="button"
          onClick={onNavigateBack}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="mt-4 modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(10,8,12,0.96)]">
          <div className="grid gap-0 lg:grid-cols-2">
            <section className="border-b border-[var(--modelsfind-line)] p-5 lg:border-b-0 lg:border-r">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
                  <UserRound className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Profile</p>
                  <h1 className="mt-2 [font-family:var(--modelsfind-display)] text-[2.4rem] leading-[0.94] tracking-[-0.05em] text-[var(--modelsfind-ink)]">
                    Keep your archive workspace ready for the next shortlist.
                  </h1>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Email</span>
                  <input value={user.email} readOnly className="h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-copy)] outline-none" />
                </label>
                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Name</span>
                  <input value={profile.name} onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] outline-none" />
                </label>
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Phone</span>
                  <input value={profile.phone} onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] outline-none" />
                </label>
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Date of birth</span>
                  <input value={profile.dateOfBirth} onChange={(event) => setProfile((prev) => ({ ...prev, dateOfBirth: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] outline-none" />
                </label>
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Language</span>
                  <input value={profile.preferredLanguage} onChange={(event) => setProfile((prev) => ({ ...prev, preferredLanguage: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] outline-none" />
                </label>
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Timezone</span>
                  <input value={profile.timezone} onChange={(event) => setProfile((prev) => ({ ...prev, timezone: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] outline-none" />
                </label>
              </div>

              <button
                type="button"
                onClick={async () => {
                  setSavingProfile(true);
                  try {
                    await onSaveProfile(profile);
                  } finally {
                    setSavingProfile(false);
                  }
                }}
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_78%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white"
                disabled={savingProfile}
              >
                <Save className="h-4 w-4" />
                {savingProfile ? 'Saving...' : 'Save profile'}
              </button>
            </section>

            <section className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
                  <LockKeyhole className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Security</p>
                  <h2 className="mt-2 [font-family:var(--modelsfind-display)] text-[2.2rem] leading-[0.96] tracking-[-0.05em] text-[var(--modelsfind-ink)]">
                    Keep archive access secure for your team and boards.
                  </h2>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Current password</span>
                  <input type="password" value={password.currentPassword} onChange={(event) => setPassword((prev) => ({ ...prev, currentPassword: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] outline-none" />
                </label>
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">New password</span>
                  <input type="password" value={password.newPassword} onChange={(event) => setPassword((prev) => ({ ...prev, newPassword: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)] outline-none" />
                </label>
              </div>

              <button
                type="button"
                onClick={async () => {
                  setSavingPassword(true);
                  try {
                    await onChangePassword(password.currentPassword, password.newPassword);
                    setPassword({ currentPassword: '', newPassword: '' });
                  } finally {
                    setSavingPassword(false);
                  }
                }}
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]"
                disabled={savingPassword}
              >
                <LockKeyhole className="h-4 w-4 text-[var(--modelsfind-primary)]" />
                {savingPassword ? 'Updating...' : 'Change password'}
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
});

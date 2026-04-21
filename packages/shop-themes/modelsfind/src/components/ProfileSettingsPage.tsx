import React from 'react';
import {
  ArrowLeft,
  LockKeyhole,
  Save,
  ShieldCheck,
  UserRound,
  WandSparkles,
} from 'lucide-react';
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
        <div className="modelsfind-panel max-w-[36rem] rounded-[2rem] border border-[var(--modelsfind-line)] p-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-primary)]">Private account</p>
          <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.6rem,7vw,4rem)] leading-[0.92] tracking-[-0.05em] text-white">
            Sign in to manage your private archive access.
          </h1>
          <p className="mx-auto mt-4 max-w-[28rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
            Keep profile details, language preferences, and security settings ready for the next shortlist session.
          </p>
          <button
            type="button"
            onClick={onNavigateToLogin}
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8">
      <div className="mx-auto max-w-[1560px]">
        <button
          type="button"
          onClick={onNavigateBack}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-copy)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <section className="modelsfind-frame modelsfind-noise mt-4 overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)]">
          <div className="p-4 md:p-6 xl:p-8">
            <section className="modelsfind-hero overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,108,240,0.24),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(214,184,255,0.14),transparent_20%),linear-gradient(180deg,rgba(10,8,14,0.82),rgba(10,8,14,0.96))]" />
              <div className="relative z-10 grid min-h-[22rem] gap-6 px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
                <div className="max-w-[40rem]">
                  <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]">Profile settings</p>
                  <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.8rem,6vw,5rem)] leading-[0.92] tracking-[-0.05em] text-white">
                    Keep your private account polished for the next booking cycle.
                  </h1>
                  <p className="mt-4 max-w-[34rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                    Treat settings like part of the premium flow: clear identity, minimal friction, and mobile-friendly controls.
                  </p>
                </div>

                <div className="modelsfind-panel rounded-[1.5rem] border border-[var(--modelsfind-line)] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Account holder</p>
                      <p className="[font-family:var(--modelsfind-display)] text-[1.8rem] leading-none tracking-[-0.04em] text-white">
                        {user.name}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-[var(--modelsfind-copy)]">{user.email}</p>
                </div>
              </div>
            </section>

            <div className="relative z-10 -mt-10 grid grid-cols-2 gap-3 px-1 md:-mt-12 md:grid-cols-4 md:gap-4 md:px-0">
              {[
                { label: 'Language', value: profile.preferredLanguage || 'en' },
                { label: 'Timezone', value: profile.timezone || 'UTC' },
                { label: 'Security', value: 'Active' },
                { label: 'Profile', value: profile.name ? 'Ready' : 'Draft' },
              ].map((metric, index) => (
                <div
                  key={metric.label}
                  className="modelsfind-panel rounded-[1.25rem] border border-[var(--modelsfind-line)] p-4"
                >
                  <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--modelsfind-copy-soft)]">{metric.label}</p>
                  <p className={index === 2 ? 'mt-3 [font-family:var(--modelsfind-display)] text-[1.8rem] leading-none text-[var(--modelsfind-primary)]' : 'mt-3 [font-family:var(--modelsfind-display)] text-[1.8rem] leading-none text-white'}>
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(20rem,0.72fr)]">
              <section className="rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Identity</p>
                    <h2 className="mt-2 [font-family:var(--modelsfind-display)] text-[2.1rem] leading-[0.96] tracking-[-0.05em] text-white">
                      Profile details
                    </h2>
                    <p className="mt-3 max-w-[34rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                      This section should feel like a premium mobile form, not a generic settings backend.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 sm:col-span-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Email</span>
                    <input
                      value={user.email}
                      readOnly
                      className="h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-copy)]"
                    />
                  </label>
                  <label className="grid gap-2 sm:col-span-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Name</span>
                    <input
                      value={profile.name}
                      onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
                      className="modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Phone</span>
                    <input
                      value={profile.phone}
                      onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
                      className="modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Date of birth</span>
                    <input
                      value={profile.dateOfBirth}
                      onChange={(event) => setProfile((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
                      className="modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Language</span>
                    <input
                      value={profile.preferredLanguage}
                      onChange={(event) => setProfile((prev) => ({ ...prev, preferredLanguage: event.target.value }))}
                      className="modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Timezone</span>
                    <input
                      value={profile.timezone}
                      onChange={(event) => setProfile((prev) => ({ ...prev, timezone: event.target.value }))}
                      className="modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                    />
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
                  className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)]"
                  disabled={savingProfile}
                >
                  <Save className="h-4 w-4" />
                  {savingProfile ? 'Saving...' : 'Save profile'}
                </button>
              </section>

              <div className="grid gap-6">
                <section className="rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
                      <LockKeyhole className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Security</p>
                      <h2 className="mt-2 [font-family:var(--modelsfind-display)] text-[2rem] leading-[0.96] tracking-[-0.05em] text-white">
                        Password controls
                      </h2>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4">
                    <label className="grid gap-2">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Current password</span>
                      <input
                        type="password"
                        value={password.currentPassword}
                        onChange={(event) => setPassword((prev) => ({ ...prev, currentPassword: event.target.value }))}
                        className="modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">New password</span>
                      <input
                        type="password"
                        value={password.newPassword}
                        onChange={(event) => setPassword((prev) => ({ ...prev, newPassword: event.target.value }))}
                        className="modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                      />
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
                    className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--modelsfind-ink)]"
                    disabled={savingPassword}
                  >
                    <LockKeyhole className="h-4 w-4 text-[var(--modelsfind-primary)]" />
                    {savingPassword ? 'Updating...' : 'Change password'}
                  </button>
                </section>

                <section className="modelsfind-panel rounded-[1.6rem] border border-[var(--modelsfind-line)] p-6">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--modelsfind-primary-soft)] text-[var(--modelsfind-primary)]">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <p className="mt-4 text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]">Operator note</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--modelsfind-copy)]">
                    Settings should stay calm and confidence-building on mobile. The account area is part of the premium product, not a disposable admin screen.
                  </p>
                  <div className="mt-5 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-[var(--modelsfind-copy)]">
                    <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[var(--modelsfind-primary)]">
                      <WandSparkles className="h-4 w-4" />
                      Mobile guidance
                    </div>
                    <p className="mt-3">Keep primary actions close, avoid dense rows, and let each control breathe on smaller screens.</p>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

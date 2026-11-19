import React from 'react';
import { Apple, ArrowLeft, Chrome, Facebook, Link2, LockKeyhole, Save, Unlink, UserRound } from 'lucide-react';
import type { ProfileSettingsPageProps } from 'shared/src/types/theme';

const FOCUS_VISIBLE_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bokmoo-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bokmoo-bg)]';

const PROVIDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'google-auth': Chrome,
  'facebook-auth': Facebook,
  'apple-auth': Apple,
};

function providerIcon(providerSlug: string): React.ComponentType<{ className?: string }> {
  return PROVIDER_ICONS[providerSlug] ?? Link2;
}

export const ProfileSettingsPage = React.memo(function ProfileSettingsPage({
  user,
  isLoading,
  isAuthenticated,
  passwordSet = true,
  connectedAccounts,
  linkableProviders,
  onSaveProfile,
  onChangePassword,
  onLinkProvider,
  onUnlinkIdentity,
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
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [connectionsError, setConnectionsError] = React.useState<string | null>(null);
  const [busyConnection, setBusyConnection] = React.useState<string | null>(null);

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
            Log In
          </button>
        </div>
      </div>
    );
  }

  const hasConnections = Boolean(onLinkProvider || onUnlinkIdentity)
    && ((connectedAccounts?.length ?? 0) > 0 || (linkableProviders?.length ?? 0) > 0);

  return (
    <div className="min-h-screen bg-[var(--bokmoo-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1080px]">
        <button
          onClick={onNavigateBack}
          className={FOCUS_VISIBLE_RING + ' inline-flex items-center gap-2 rounded-full border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-copy)]'}
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
                <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                  Traveler profile
                </p>
                <h1 className="mt-2 text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                  Keep your BOKMOO account ready for the next trip.
                </h1>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Email</span>
                <input value={user.email} readOnly className="h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-copy)] outline-none" />
              </label>
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Name</span>
                <input value={profile.name} onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Phone</span>
                <input value={profile.phone} onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Date of birth</span>
                <input value={profile.dateOfBirth} onChange={(event) => setProfile((prev) => ({ ...prev, dateOfBirth: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Language</span>
                <input value={profile.preferredLanguage} onChange={(event) => setProfile((prev) => ({ ...prev, preferredLanguage: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Timezone</span>
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
                <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                  Password
                </p>
                <h2 className="mt-2 text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                  Keep access secure between trips.
                </h2>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              {passwordSet && (
                <label className="grid gap-2">
                  <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Current password</span>
                  <input type="password" value={password.currentPassword} onChange={(event) => setPassword((prev) => ({ ...prev, currentPassword: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
                </label>
              )}
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                  {passwordSet ? 'New password' : 'Set a password'}
                </span>
                <input type="password" value={password.newPassword} onChange={(event) => setPassword((prev) => ({ ...prev, newPassword: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg)] px-4 text-sm text-[var(--bokmoo-ink)] outline-none" />
              </label>
            </div>

            {passwordError && (
              <p className="mt-4 text-sm leading-6 text-red-400" role="alert">{passwordError}</p>
            )}

            <button
              onClick={async () => {
                setSavingPassword(true);
                setPasswordError(null);
                try {
                  await onChangePassword(password.currentPassword, password.newPassword);
                  setPassword({ currentPassword: '', newPassword: '' });
                } catch (changeError) {
                  setPasswordError(changeError instanceof Error && changeError.message
                    ? changeError.message
                    : passwordSet
                      ? 'Could not change the password. Check your current password and try again.'
                      : 'Could not set the password. Pick at least 8 characters and try again.');
                } finally {
                  setSavingPassword(false);
                }
              }}
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--bokmoo-line-strong)] bg-[var(--bokmoo-bg)] px-5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--bokmoo-ink)]"
              disabled={savingPassword || password.newPassword.length === 0}
              type="button"
            >
              <LockKeyhole className="h-4 w-4 text-[var(--bokmoo-gold)]" />
              {savingPassword ? 'Updating...' : passwordSet ? 'Change password' : 'Set password'}
            </button>
          </section>

          {hasConnections && (
            <section className="rounded-[var(--bokmoo-radius-xl)] border border-[var(--bokmoo-line)] bg-[var(--bokmoo-bg-elevated)] p-6 shadow-[var(--bokmoo-shadow)] sm:p-8 lg:col-span-2">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--bokmoo-gold)_14%,transparent)] text-[var(--bokmoo-gold)]">
                  <Link2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">
                    Connected accounts
                  </p>
                  <h2 className="mt-2 text-3xl leading-[1] tracking-[-0.04em] text-[var(--bokmoo-ink)]">
                    Sign in with one tap next time.
                  </h2>
                </div>
              </div>

              {connectionsError && (
                <p className="mt-4 text-sm leading-6 text-red-400" role="alert">{connectionsError}</p>
              )}

              {(connectedAccounts?.length ?? 0) > 0 && (
                <div className="mt-6 divide-y divide-[var(--bokmoo-line)] rounded-[1rem] border border-[var(--bokmoo-line)]">
                  {connectedAccounts!.map((account) => {
                    const Icon = providerIcon(account.providerSlug);
                    return (
                      <div key={account.id} className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--bokmoo-line)] text-[var(--bokmoo-gold)]">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--bokmoo-ink)]">{account.label}</p>
                            <p className="text-xs text-[var(--bokmoo-copy-soft)]">
                              Linked{account.createdAt ? ` ${new Date(account.createdAt).toLocaleDateString()}` : ''}
                            </p>
                          </div>
                        </div>
                        {onUnlinkIdentity && (
                          <button
                            onClick={async () => {
                              setBusyConnection(account.id);
                              setConnectionsError(null);
                              try {
                                await onUnlinkIdentity(account.id);
                              } catch (unlinkError) {
                                setConnectionsError(unlinkError instanceof Error && unlinkError.message
                                  ? unlinkError.message
                                  : 'Could not remove this sign-in method.');
                              } finally {
                                setBusyConnection(null);
                              }
                            }}
                            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--bokmoo-line)] px-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--bokmoo-copy)] disabled:opacity-50"
                            disabled={busyConnection === account.id}
                            type="button"
                          >
                            <Unlink className="h-3.5 w-3.5" />
                            {busyConnection === account.id ? 'Removing...' : 'Unlink'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {(linkableProviders?.length ?? 0) > 0 && (
                <div className="mt-6">
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bokmoo-copy-soft)]">Add a sign-in method</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {linkableProviders!.map((provider) => {
                      const Icon = providerIcon(provider.providerSlug);
                      return (
                        <button
                          key={provider.providerSlug}
                          onClick={async () => {
                            if (!onLinkProvider) return;
                            setBusyConnection(provider.providerSlug);
                            setConnectionsError(null);
                            try {
                              await onLinkProvider(provider.providerSlug);
                            } catch (linkError) {
                              setConnectionsError(linkError instanceof Error && linkError.message
                                ? linkError.message
                                : 'Could not start linking. Please try again.');
                              setBusyConnection(null);
                            }
                          }}
                          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--bokmoo-gold)_28%,transparent)] px-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--bokmoo-ink)] disabled:opacity-50"
                          disabled={busyConnection === provider.providerSlug}
                          type="button"
                        >
                          <Icon className="h-3.5 w-3.5 text-[var(--bokmoo-gold)]" />
                          {busyConnection === provider.providerSlug ? 'Connecting...' : `Link ${provider.label}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
});

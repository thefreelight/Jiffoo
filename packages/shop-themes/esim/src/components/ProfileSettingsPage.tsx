import React from 'react';
import { ArrowLeft, LockKeyhole, Save, UserRound } from 'lucide-react';
import type { ProfileSettingsPageProps } from 'shared/src/types/theme';
import { pickCopy, type ThemeCopy } from '../site';

export const ProfileSettingsPage = React.memo(function ProfileSettingsPage({
  user,
  isLoading,
  isAuthenticated,
  onSaveProfile,
  onChangePassword,
  onNavigateBack,
  onNavigateToLogin,
  locale,
}: ProfileSettingsPageProps) {
  const t = (copy: ThemeCopy) => pickCopy(locale, copy);
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
    return <div className="min-h-screen bg-[var(--esim-bg)]" />;
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--esim-bg)] px-4">
        <div className="rounded-[var(--esim-radius-xl)] border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-10 text-center shadow-[var(--esim-shadow)]">
          <h1 className="text-3xl leading-[1] tracking-[-0.04em] text-[var(--esim-ink)]">{t({ en: 'Sign in to manage your account', hans: '登入以管理你的账户', hant: '登入以管理你的帳戶' })}</h1>
          <button
            onClick={onNavigateToLogin}
            className="mt-6 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--esim-gold)_82%,white),color-mix(in_oklab,var(--esim-gold)_65%,black))] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--esim-bg)]"
            type="button"
          >
            {t({ en: 'Log In', hans: '登录', hant: '登入' })}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--esim-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1080px]">
        <button
          onClick={onNavigateBack}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--esim-copy)]"
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          {t({ en: 'Back', hans: '返回', hant: '返回' })}
        </button>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[var(--esim-radius-xl)] border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-6 shadow-[var(--esim-shadow)] sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--esim-gold)_14%,transparent)] text-[var(--esim-gold)]">
                <UserRound className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy-soft)]">
                  {t({ en: 'Traveler profile', hans: '旅行者资料', hant: '旅行者資料' })}
                </p>
                <h1 className="mt-2 text-3xl leading-[1] tracking-[-0.04em] text-[var(--esim-ink)]">
                  {t({ en: 'Keep your BOKMOO account ready for the next trip.', hans: '让您的 BOKMOO 账户为下一次旅行做好准备。', hant: '讓您的 BOKMOO 帳戶為下一次旅行做好準備。' })}
                </h1>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy-soft)]">{t({ en: 'Email Address', hans: '邮箱', hant: '信箱' })}</span>
                <input value={user.email} readOnly className="h-12 rounded-[1rem] border border-[var(--esim-line)] bg-[var(--esim-bg)] px-4 text-sm text-[var(--esim-copy)] outline-none" />
              </label>
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy-soft)]">{t({ en: 'Full name', hans: '姓名', hant: '姓名' })}</span>
                <input value={profile.name} onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--esim-line)] bg-[var(--esim-bg)] px-4 text-sm text-[var(--esim-ink)] outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy-soft)]">{t({ en: 'Phone Number', hans: '手机号', hant: '手機號碼' })}</span>
                <input value={profile.phone} onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--esim-line)] bg-[var(--esim-bg)] px-4 text-sm text-[var(--esim-ink)] outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy-soft)]">{t({ en: 'Date of Birth', hans: '出生日期', hant: '出生日期' })}</span>
                <input value={profile.dateOfBirth} onChange={(event) => setProfile((prev) => ({ ...prev, dateOfBirth: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--esim-line)] bg-[var(--esim-bg)] px-4 text-sm text-[var(--esim-ink)] outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy-soft)]">{t({ en: 'Language', hans: '语言', hant: '語言' })}</span>
                <input value={profile.preferredLanguage} onChange={(event) => setProfile((prev) => ({ ...prev, preferredLanguage: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--esim-line)] bg-[var(--esim-bg)] px-4 text-sm text-[var(--esim-ink)] outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy-soft)]">{t({ en: 'Timezone', hans: '时区', hant: '時區' })}</span>
                <input value={profile.timezone} onChange={(event) => setProfile((prev) => ({ ...prev, timezone: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--esim-line)] bg-[var(--esim-bg)] px-4 text-sm text-[var(--esim-ink)] outline-none" />
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
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--esim-gold)_82%,white),color-mix(in_oklab,var(--esim-gold)_65%,black))] px-5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--esim-bg)]"
              disabled={savingProfile}
              type="button"
            >
              <Save className="h-4 w-4" />
              {savingProfile ? t({ en: 'Saving...', hans: '保存中...', hant: '儲存中…' }) : t({ en: 'Save profile', hans: '保存资料', hant: '儲存資料' })}
            </button>
          </section>

          <section className="rounded-[var(--esim-radius-xl)] border border-[var(--esim-line)] bg-[var(--esim-bg-elevated)] p-6 shadow-[var(--esim-shadow)] sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[color:color-mix(in_oklab,var(--esim-gold)_14%,transparent)] text-[var(--esim-gold)]">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy-soft)]">
                  {t({ en: 'Password', hans: '密码', hant: '密碼' })}
                </p>
                <h2 className="mt-2 text-3xl leading-[1] tracking-[-0.04em] text-[var(--esim-ink)]">
                  {t({ en: 'Keep access secure between trips.', hans: '在两次旅行之间保持账户访问安全。', hant: '在兩次旅行之間保持帳戶存取安全。' })}
                </h2>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy-soft)]">{t({ en: 'Current password', hans: '当前密码', hant: '目前密碼' })}</span>
                <input type="password" value={password.currentPassword} onChange={(event) => setPassword((prev) => ({ ...prev, currentPassword: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--esim-line)] bg-[var(--esim-bg)] px-4 text-sm text-[var(--esim-ink)] outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy-soft)]">{t({ en: 'New password', hans: '新密码', hant: '新密碼' })}</span>
                <input type="password" value={password.newPassword} onChange={(event) => setPassword((prev) => ({ ...prev, newPassword: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--esim-line)] bg-[var(--esim-bg)] px-4 text-sm text-[var(--esim-ink)] outline-none" />
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
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--esim-line-strong)] bg-[var(--esim-bg)] px-5 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--esim-ink)]"
              disabled={savingPassword}
              type="button"
            >
              <LockKeyhole className="h-4 w-4 text-[var(--esim-gold)]" />
              {savingPassword ? t({ en: 'Updating...', hans: '更新中...', hant: '更新中…' }) : t({ en: 'Change password', hans: '修改密码', hant: '變更密碼' })}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
});

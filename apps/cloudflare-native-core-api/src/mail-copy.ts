/**
 * The words of the two account mails — the sign-up code and the password-reset
 * code — in every storefront language. An instance names its language with
 * EMAIL_LOCALE; an instance that names none writes in English, as it always has.
 *
 * The strings are functions so a name and a brand are put in place without a
 * template engine; the caller escapes them for HTML.
 */
export type MailLocale = 'en' | 'zh-Hans' | 'zh-Hant' | 'ja' | 'ko' | 'fr' | 'de';

export interface MailCopy {
  subject: (brand: string, code: string) => string;
  /** The plain-text alternative: the whole message. */
  text: (name: string, brand: string, code: string) => string;
  title: string;
  intro: (name: string, brand: string) => string;
  /** "This code expires in | 10 minutes | ." — the time is set in bold. */
  expires: readonly [string, string, string];
  ignore: string;
}

export interface AccountMailCopy {
  verification: MailCopy;
  reset: MailCopy;
  footer: (brand: string) => string;
  /** Said of an address nobody reads; an instance whose address is read leaves it out. */
  unmonitored: string;
}

const COPY: Record<MailLocale, AccountMailCopy> = {
  en: {
    verification: {
      subject: (brand, code) => `${brand} verification code: ${code}`,
      text: (name, brand, code) => `Hi ${name},\n\nYour ${brand} verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't request this code, you can safely ignore this email.`,
      title: 'Verify your email',
      intro: (name, brand) => `Hi ${name}, use the verification code below to finish setting up your ${brand} account.`,
      expires: ['This code expires in ', '10 minutes', '.'],
      ignore: "If you didn't request this code, you can safely ignore this email — your account stays unused and nothing changes.",
    },
    reset: {
      subject: (brand, code) => `${brand} password reset code: ${code}`,
      text: (name, brand, code) => `Hi ${name},\n\nYour ${brand} password reset code is ${code}. It expires in 10 minutes.\n\nIf you didn't request a password reset, ignore this email — your password stays unchanged.`,
      title: 'Reset your password',
      intro: (name, brand) => `Hi ${name}, use the code below to reset your ${brand} password.`,
      expires: ['This code expires in ', '10 minutes', '.'],
      ignore: "If you didn't request a password reset, ignore this email — your password stays unchanged.",
    },
    footer: (brand) => `This is an automated message from ${brand}.`,
    unmonitored: 'Replies to this address are not monitored.',
  },
  'zh-Hans': {
    verification: {
      subject: (brand, code) => `${brand} 验证码：${code}`,
      text: (name, brand, code) => `${name}，你好！\n\n你的 ${brand} 验证码是 ${code}，10 分钟内有效。\n\n如果不是你本人申请的，忽略这封邮件即可——账号不会被启用，什么都不会发生。`,
      title: '验证你的邮箱',
      intro: (name, brand) => `${name}，你好！请用下面的验证码完成 ${brand} 账号的注册。`,
      expires: ['验证码 ', '10 分钟', ' 内有效。'],
      ignore: '如果不是你本人申请的，忽略这封邮件即可——账号不会被启用，什么都不会发生。',
    },
    reset: {
      subject: (brand, code) => `${brand} 重置密码验证码：${code}`,
      text: (name, brand, code) => `${name}，你好！\n\n你的 ${brand} 重置密码验证码是 ${code}，10 分钟内有效。\n\n如果你没有申请重置密码，忽略这封邮件即可——你的密码不会改变。`,
      title: '重置你的密码',
      intro: (name, brand) => `${name}，你好！请用下面的验证码为你的 ${brand} 账号设置新密码。`,
      expires: ['验证码 ', '10 分钟', ' 内有效。'],
      ignore: '如果你没有申请重置密码，忽略这封邮件即可——你的密码不会改变。',
    },
    footer: (brand) => `这是 ${brand} 发出的自动邮件。`,
    unmonitored: '回复这个地址不会被查看。',
  },
  'zh-Hant': {
    verification: {
      subject: (brand, code) => `${brand} 驗證碼：${code}`,
      text: (name, brand, code) => `${name}，你好！\n\n你的 ${brand} 驗證碼是 ${code}，10 分鐘內有效。\n\n如果不是你本人申請的，忽略這封郵件即可——帳號不會被啟用，什麼都不會發生。`,
      title: '驗證你的電子郵件',
      intro: (name, brand) => `${name}，你好！請用下方的驗證碼完成 ${brand} 帳號的註冊。`,
      expires: ['驗證碼 ', '10 分鐘', ' 內有效。'],
      ignore: '如果不是你本人申請的，忽略這封郵件即可——帳號不會被啟用，什麼都不會發生。',
    },
    reset: {
      subject: (brand, code) => `${brand} 重設密碼驗證碼：${code}`,
      text: (name, brand, code) => `${name}，你好！\n\n你的 ${brand} 重設密碼驗證碼是 ${code}，10 分鐘內有效。\n\n如果你沒有申請重設密碼，忽略這封郵件即可——你的密碼不會改變。`,
      title: '重設你的密碼',
      intro: (name, brand) => `${name}，你好！請用下方的驗證碼為你的 ${brand} 帳號設定新密碼。`,
      expires: ['驗證碼 ', '10 分鐘', ' 內有效。'],
      ignore: '如果你沒有申請重設密碼，忽略這封郵件即可——你的密碼不會改變。',
    },
    footer: (brand) => `這是 ${brand} 發出的自動郵件。`,
    unmonitored: '回覆這個地址不會被查看。',
  },
  ja: {
    verification: {
      subject: (brand, code) => `${brand} 確認コード：${code}`,
      text: (name, brand, code) => `${name} さん、こんにちは。\n\n${brand} の確認コードは ${code} です。有効期限は 10 分間です。\n\nこのコードを申し込んだ覚えがない場合は、このメールを無視してください。アカウントは有効にならず、何も変わりません。`,
      title: 'メールアドレスの確認',
      intro: (name, brand) => `${name} さん、こんにちは。下記の確認コードを使って ${brand} アカウントの登録を完了してください。`,
      expires: ['コードの有効期限は ', '10 分間', ' です。'],
      ignore: 'このコードを申し込んだ覚えがない場合は、このメールを無視してください。アカウントは有効にならず、何も変わりません。',
    },
    reset: {
      subject: (brand, code) => `${brand} パスワード再設定コード：${code}`,
      text: (name, brand, code) => `${name} さん、こんにちは。\n\n${brand} のパスワード再設定コードは ${code} です。有効期限は 10 分間です。\n\nパスワードの再設定を申し込んだ覚えがない場合は、このメールを無視してください。パスワードは変更されません。`,
      title: 'パスワードの再設定',
      intro: (name, brand) => `${name} さん、こんにちは。下記のコードを使って ${brand} アカウントの新しいパスワードを設定してください。`,
      expires: ['コードの有効期限は ', '10 分間', ' です。'],
      ignore: 'パスワードの再設定を申し込んだ覚えがない場合は、このメールを無視してください。パスワードは変更されません。',
    },
    footer: (brand) => `これは ${brand} から送信された自動メールです。`,
    unmonitored: 'このアドレスへの返信は確認されません。',
  },
  ko: {
    verification: {
      subject: (brand, code) => `${brand} 인증 코드: ${code}`,
      text: (name, brand, code) => `${name} 님, 안녕하세요.\n\n${brand} 인증 코드는 ${code}입니다. 10분 동안 유효합니다.\n\n이 코드를 요청한 적이 없다면 이 이메일은 무시해도 됩니다. 계정은 활성화되지 않으며 아무것도 바뀌지 않습니다.`,
      title: '이메일 인증',
      intro: (name, brand) => `${name} 님, 안녕하세요. 아래 인증 코드를 입력해 ${brand} 계정 가입을 완료해 주세요.`,
      expires: ['이 코드는 ', '10분', ' 동안 유효합니다.'],
      ignore: '이 코드를 요청한 적이 없다면 이 이메일은 무시해도 됩니다. 계정은 활성화되지 않으며 아무것도 바뀌지 않습니다.',
    },
    reset: {
      subject: (brand, code) => `${brand} 비밀번호 재설정 코드: ${code}`,
      text: (name, brand, code) => `${name} 님, 안녕하세요.\n\n${brand} 비밀번호 재설정 코드는 ${code}입니다. 10분 동안 유효합니다.\n\n비밀번호 재설정을 요청한 적이 없다면 이 이메일은 무시해도 됩니다. 비밀번호는 그대로 유지됩니다.`,
      title: '비밀번호 재설정',
      intro: (name, brand) => `${name} 님, 안녕하세요. 아래 코드를 입력해 ${brand} 계정의 새 비밀번호를 설정해 주세요.`,
      expires: ['이 코드는 ', '10분', ' 동안 유효합니다.'],
      ignore: '비밀번호 재설정을 요청한 적이 없다면 이 이메일은 무시해도 됩니다. 비밀번호는 그대로 유지됩니다.',
    },
    footer: (brand) => `이 메일은 ${brand}에서 자동으로 보낸 메일입니다.`,
    unmonitored: '이 주소로 보낸 회신은 확인하지 않습니다.',
  },
  fr: {
    verification: {
      subject: (brand, code) => `Code de vérification ${brand} : ${code}`,
      text: (name, brand, code) => `Bonjour ${name},\n\nVotre code de vérification ${brand} est ${code}. Il expire dans 10 minutes.\n\nSi vous n’avez pas demandé ce code, vous pouvez ignorer cet e-mail — votre compte reste inutilisé et rien ne change.`,
      title: 'Vérifiez votre e-mail',
      intro: (name, brand) => `Bonjour ${name}, utilisez le code de vérification ci-dessous pour finaliser la création de votre compte ${brand}.`,
      expires: ['Ce code expire dans ', '10 minutes', '.'],
      ignore: 'Si vous n’avez pas demandé ce code, vous pouvez ignorer cet e-mail — votre compte reste inutilisé et rien ne change.',
    },
    reset: {
      subject: (brand, code) => `Code de réinitialisation ${brand} : ${code}`,
      text: (name, brand, code) => `Bonjour ${name},\n\nVotre code de réinitialisation du mot de passe ${brand} est ${code}. Il expire dans 10 minutes.\n\nSi vous n’avez pas demandé de réinitialisation, ignorez cet e-mail — votre mot de passe reste inchangé.`,
      title: 'Réinitialisez votre mot de passe',
      intro: (name, brand) => `Bonjour ${name}, utilisez le code ci-dessous pour définir un nouveau mot de passe pour votre compte ${brand}.`,
      expires: ['Ce code expire dans ', '10 minutes', '.'],
      ignore: 'Si vous n’avez pas demandé de réinitialisation, ignorez cet e-mail — votre mot de passe reste inchangé.',
    },
    footer: (brand) => `Ceci est un message automatique de ${brand}.`,
    unmonitored: 'Les réponses à cette adresse ne sont pas lues.',
  },
  de: {
    verification: {
      subject: (brand, code) => `${brand} Bestätigungscode: ${code}`,
      text: (name, brand, code) => `Hallo ${name},\n\nIhr ${brand} Bestätigungscode lautet ${code}. Er läuft in 10 Minuten ab.\n\nWenn Sie diesen Code nicht angefordert haben, können Sie diese E-Mail einfach ignorieren — Ihr Konto bleibt ungenutzt, es ändert sich nichts.`,
      title: 'E-Mail-Adresse bestätigen',
      intro: (name, brand) => `Hallo ${name}, verwenden Sie den unten stehenden Bestätigungscode, um die Erstellung Ihres ${brand}-Kontos abzuschließen.`,
      expires: ['Dieser Code läuft in ', '10 Minuten', ' ab.'],
      ignore: 'Wenn Sie diesen Code nicht angefordert haben, können Sie diese E-Mail einfach ignorieren — Ihr Konto bleibt ungenutzt, es ändert sich nichts.',
    },
    reset: {
      subject: (brand, code) => `${brand} Code zum Zurücksetzen des Passworts: ${code}`,
      text: (name, brand, code) => `Hallo ${name},\n\nIhr ${brand} Code zum Zurücksetzen des Passworts lautet ${code}. Er läuft in 10 Minuten ab.\n\nWenn Sie das Zurücksetzen nicht angefordert haben, ignorieren Sie diese E-Mail — Ihr Passwort bleibt unverändert.`,
      title: 'Passwort zurücksetzen',
      intro: (name, brand) => `Hallo ${name}, verwenden Sie den unten stehenden Code, um ein neues Passwort für Ihr ${brand}-Konto festzulegen.`,
      expires: ['Dieser Code läuft in ', '10 Minuten', ' ab.'],
      ignore: 'Wenn Sie das Zurücksetzen nicht angefordert haben, ignorieren Sie diese E-Mail — Ihr Passwort bleibt unverändert.',
    },
    footer: (brand) => `Dies ist eine automatische Nachricht von ${brand}.`,
    unmonitored: 'Antworten an diese Adresse werden nicht gelesen.',
  },
};

const LOCALES: readonly MailLocale[] = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'fr', 'de'];

/** The language an instance named. A region picks the variant of its script; anything unknown is English. */
export function resolveMailLocale(value: string | undefined): MailLocale {
  const named = value?.trim().toLowerCase();
  if (!named) return 'en';
  const exact = LOCALES.find((locale) => locale.toLowerCase() === named);
  if (exact) return exact;
  const [language, region = ''] = named.split('-');
  if (language === 'zh') return ['tw', 'hk', 'mo'].includes(region) ? 'zh-Hant' : 'zh-Hans';
  const byLanguage = LOCALES.find((locale) => locale.split('-')[0] === language);
  return byLanguage ?? 'en';
}

export function accountMailCopy(locale: MailLocale): AccountMailCopy {
  return COPY[locale];
}

/** For tests and tooling: every language the mails are written in. */
export const MAIL_LOCALES = LOCALES;

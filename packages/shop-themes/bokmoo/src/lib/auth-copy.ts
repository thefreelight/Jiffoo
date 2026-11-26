import type { ThemeConfig } from 'shared/src/types/theme';
import { pickCopy, resolveBokmooSiteConfig } from '../site';

/**
 * Everything the sign-in, sign-up, password-reset and sign-in-callback pages say, in the seven storefront
 * languages. Before, these pages were written in English only, whatever language the storefront was in.
 */

export interface AuthCopy {
  en: string;
  hans: string;
  hant: string;
  ja: string;
  ko: string;
  fr: string;
  de: string;
}

export const authText = (locale: string | undefined, copy: AuthCopy): string => pickCopy(locale, copy);

const STOREFRONT_LOCALES = new Set(['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'fr', 'de']);

/**
 * The storefront language of the page: the one the storefront passed, else the one in the page's
 * address (`/zh-Hans/auth/…`). Storefront builds that predate a page pass it no language at all, and
 * the page then spoke English to everyone.
 */
export function pageLocale(locale: string | null | undefined): string | undefined {
  if (locale && STOREFRONT_LOCALES.has(locale)) return locale;
  if (typeof window === 'undefined') return locale || undefined;
  const inAddress = window.location.pathname.split('/').find((part) => STOREFRONT_LOCALES.has(part));
  return inAddress ?? locale ?? undefined;
}

export const AUTH = {
  accountEyebrow: { en: 'Secure account access', hans: '安全登录', hant: '安全登入', ja: '安全なアカウントへのアクセス', ko: '안전한 계정 액세스', fr: 'Accès sécurisé au compte', de: 'Sicherer Kontozugriff' },
  loginTitle: { en: 'Sign in before your next border.', hans: '下一段旅程出发前，先登录。', hant: '下一段旅程出發前，先登入。', ja: '次の旅に出る前に、サインイン。', ko: '다음 여행을 떠나기 전에 로그인하세요.', fr: 'Connectez-vous avant votre prochain départ.', de: 'Melden Sie sich an, bevor Ihre nächste Reise beginnt.' },
  loginLead: {
    en: 'Manage BOKMOO eSIM profiles, orders, and activation details from the same black-and-gold travel control surface.',
    hans: '在同一个账户里管理你的 BOKMOO eSIM 配置文件、订单和激活信息。',
    hant: '在同一個帳戶裡管理你的 BOKMOO eSIM 設定檔、訂單和啟用資訊。',
    ja: 'BOKMOO の eSIM プロファイル、注文、アクティベーション情報をひとつの場所で管理できます。',
    ko: 'BOKMOO eSIM 프로필, 주문, 활성화 정보를 한 곳에서 관리하세요.',
    fr: 'Gérez vos profils eSIM BOKMOO, vos commandes et vos détails d’activation au même endroit.',
    de: 'Verwalten Sie Ihre BOKMOO-eSIM-Profile, Bestellungen und Aktivierungsdetails an einem Ort.',
  },
  featureOrdersTitle: { en: 'Orders', hans: '订单', hant: '訂單', ja: '注文', ko: '주문', fr: 'Commandes', de: 'Bestellungen' },
  featureOrdersBody: { en: 'Track purchases', hans: '查看购买记录', hant: '查看購買記錄', ja: '購入履歴を確認', ko: '구매 내역 확인', fr: 'Suivre vos achats', de: 'Käufe verfolgen' },
  featureProfilesTitle: { en: 'Profiles', hans: 'eSIM 配置文件', hant: 'eSIM 設定檔', ja: 'プロファイル', ko: '프로필', fr: 'Profils', de: 'Profile' },
  featureProfilesBody: { en: 'Manage eSIMs', hans: '管理你的 eSIM', hant: '管理你的 eSIM', ja: 'eSIM を管理', ko: 'eSIM 관리', fr: 'Gérer vos eSIM', de: 'eSIMs verwalten' },
  featureSupportTitle: { en: 'Support', hans: '客服', hant: '客服', ja: 'サポート', ko: '고객 지원', fr: 'Assistance', de: 'Support' },
  featureSupportBody: { en: 'Get help fast', hans: '快速获得帮助', hant: '快速獲得協助', ja: 'すぐにサポートを受けられる', ko: '빠르게 도움 받기', fr: 'Obtenez de l’aide rapidement', de: 'Schnelle Hilfe' },
  welcomeBack: { en: 'Welcome back', hans: '欢迎回来', hant: '歡迎回來', ja: 'おかえりなさい', ko: '다시 오신 것을 환영합니다', fr: 'Bon retour', de: 'Willkommen zurück' },
  loginSub: {
    en: 'Continue to your orders, profiles, and activation workspace.',
    hans: '继续前往你的订单、eSIM 配置文件和激活中心。',
    hant: '繼續前往你的訂單、eSIM 設定檔和啟用中心。',
    ja: '注文、プロファイル、アクティベーション画面に進みます。',
    ko: '주문, 프로필, 활성화 화면으로 계속 진행합니다.',
    fr: 'Retrouvez vos commandes, vos profils et votre espace d’activation.',
    de: 'Weiter zu Ihren Bestellungen, Profilen und zur Aktivierung.',
  },
  orEmail: { en: 'or email', hans: '或使用邮箱', hant: '或使用電子郵件', ja: 'またはメールアドレス', ko: '또는 이메일', fr: 'ou par e-mail', de: 'oder per E-Mail' },
  email: { en: 'Email', hans: '邮箱', hant: '電子郵件', ja: 'メールアドレス', ko: '이메일', fr: 'E-mail', de: 'E-Mail' },
  password: { en: 'Password', hans: '密码', hant: '密碼', ja: 'パスワード', ko: '비밀번호', fr: 'Mot de passe', de: 'Passwort' },
  newPassword: { en: 'New password', hans: '新密码', hant: '新密碼', ja: '新しいパスワード', ko: '새 비밀번호', fr: 'Nouveau mot de passe', de: 'Neues Passwort' },
  confirmPassword: { en: 'Confirm password', hans: '确认密码', hant: '確認密碼', ja: 'パスワードの確認', ko: '비밀번호 확인', fr: 'Confirmer le mot de passe', de: 'Passwort bestätigen' },
  showPassword: { en: 'Show password', hans: '显示密码', hant: '顯示密碼', ja: 'パスワードを表示', ko: '비밀번호 표시', fr: 'Afficher le mot de passe', de: 'Passwort anzeigen' },
  hidePassword: { en: 'Hide password', hans: '隐藏密码', hant: '隱藏密碼', ja: 'パスワードを隠す', ko: '비밀번호 숨기기', fr: 'Masquer le mot de passe', de: 'Passwort verbergen' },
  firstName: { en: 'First name', hans: '名', hant: '名', ja: '名', ko: '이름', fr: 'Prénom', de: 'Vorname' },
  lastName: { en: 'Last name', hans: '姓', hant: '姓', ja: '姓', ko: '성', fr: 'Nom', de: 'Nachname' },
  firstNameExample: { en: 'Ada', hans: '三', hant: '三', ja: '花子', ko: '길동', fr: 'Ada', de: 'Ada' },
  lastNameExample: { en: 'Lovelace', hans: '张', hant: '張', ja: '山田', ko: '홍', fr: 'Lovelace', de: 'Lovelace' },
  forgotPassword: { en: 'Forgot password', hans: '忘记密码', hant: '忘記密碼', ja: 'パスワードをお忘れですか', ko: '비밀번호를 잊으셨나요', fr: 'Mot de passe oublié ?', de: 'Passwort vergessen' },
  signingIn: { en: 'Signing in', hans: '正在登录', hant: '正在登入', ja: 'サインイン中', ko: '로그인 중', fr: 'Connexion', de: 'Anmeldung' },
  signIn: { en: 'Sign in', hans: '登录', hant: '登入', ja: 'サインイン', ko: '로그인', fr: 'Se connecter', de: 'Anmelden' },
  newToBrand: { en: 'New to {brand}?', hans: '还没有 {brand} 账户？', hant: '還沒有 {brand} 帳戶？', ja: '{brand} のアカウントをお持ちでない方', ko: '{brand} 계정이 없으신가요?', fr: 'Nouveau sur {brand} ?', de: 'Neu bei {brand}?' },
  createAccount: { en: 'Create account', hans: '创建账户', hant: '建立帳戶', ja: 'アカウントを作成', ko: '계정 만들기', fr: 'Créer un compte', de: 'Konto erstellen' },
  registerEyebrow: { en: 'Protected traveler identity', hans: '旅行者身份保护', hant: '旅行者身分保護', ja: '旅行者を守る本人確認', ko: '여행자를 위한 보호된 신원', fr: 'Identité de voyageur protégée', de: 'Geschützte Reisende-Identität' },
  registerTitle: {
    en: 'Create the account your eSIMs follow.',
    hans: '为你的 eSIM 创建一个随身账户。',
    hant: '為你的 eSIM 建立一個隨身帳戶。',
    ja: 'あなたの eSIM をひとつにまとめるアカウントを作成。',
    ko: 'eSIM을 한곳에 모아두는 계정을 만드세요.',
    fr: 'Créez le compte qui suit vos eSIM.',
    de: 'Erstellen Sie das Konto, das Ihre eSIMs begleitet.',
  },
  registerLead: {
    en: 'Keep orders, activation codes, profile history, and support cases attached to one BOKMOO identity.',
    hans: '订单、激活码、配置文件记录和客服工单，都归在同一个 BOKMOO 身份下。',
    hant: '訂單、啟用碼、設定檔記錄和客服工單，都歸在同一個 BOKMOO 身分下。',
    ja: '注文、アクティベーションコード、プロファイル履歴、サポート履歴をひとつの BOKMOO ID にまとめます。',
    ko: '주문, 활성화 코드, 프로필 기록, 문의 내역을 하나의 BOKMOO 계정에서 관리하세요.',
    fr: 'Commandes, codes d’activation, historique de profils et demandes d’assistance : tout est rattaché à une seule identité BOKMOO.',
    de: 'Bestellungen, Aktivierungscodes, Profilhistorie und Supportfälle – alles an einer BOKMOO-Identität.',
  },
  registerSub: {
    en: 'Start with a secure profile for purchases and global activation support.',
    hans: '先创建一个安全档案，用于购买和全球激活支持。',
    hant: '先建立一個安全檔案，用於購買和全球啟用支援。',
    ja: '購入と世界でのアクティベーションサポートのための安全なプロフィールを作成しましょう。',
    ko: '구매와 글로벌 활성화 지원을 위한 안전한 프로필을 만들어 보세요.',
    fr: 'Commencez par un profil sécurisé pour vos achats et l’assistance à l’activation dans le monde entier.',
    de: 'Beginnen Sie mit einem sicheren Profil für Einkäufe und weltweite Aktivierungshilfe.',
  },
  passwordsDiffer: {
    en: 'Passwords do not match',
    hans: '两次输入的密码不一致',
    hant: '兩次輸入的密碼不一致',
    ja: 'パスワードが一致しません',
    ko: '비밀번호가 일치하지 않습니다',
    fr: 'Les mots de passe ne correspondent pas',
    de: 'Passwörter stimmen nicht überein',
  },
  creating: { en: 'Creating', hans: '正在创建', hant: '正在建立', ja: '作成中', ko: '생성 중', fr: 'Création', de: 'Wird erstellt' },
  haveAccount: { en: 'Already have an account?', hans: '已有账户？', hant: '已有帳戶？', ja: 'すでにアカウントをお持ちですか？', ko: '이미 계정이 있으신가요?', fr: 'Vous avez déjà un compte ?', de: 'Sie haben bereits ein Konto?' },
  // password reset
  resetTitle: { en: 'Reset your password', hans: '重置密码', hant: '重設密碼', ja: 'パスワードをリセット', ko: '비밀번호 재설정', fr: 'Réinitialiser votre mot de passe', de: 'Passwort zurücksetzen' },
  resetLead: {
    en: 'Enter your email and we send a six-digit code. Use it to set a new password.',
    hans: '输入邮箱，我们会发送一个六位数验证码，用它设置新密码。',
    hant: '輸入電子郵件，我們會傳送一個六位數驗證碼，用它設定新密碼。',
    ja: 'メールアドレスを入力すると 6 桁のコードをお送りします。そのコードで新しいパスワードを設定できます。',
    ko: '이메일을 입력하면 6자리 코드를 보내드립니다. 코드로 새 비밀번호를 설정하세요.',
    fr: 'Saisissez votre e-mail : nous vous envoyons un code à six chiffres pour définir un nouveau mot de passe.',
    de: 'Geben Sie Ihre E-Mail ein – wir senden einen sechsstelligen Code, mit dem Sie ein neues Passwort festlegen.',
  },
  sendCode: { en: 'Send code', hans: '发送验证码', hant: '傳送驗證碼', ja: 'コードを送信', ko: '코드 보내기', fr: 'Envoyer le code', de: 'Code senden' },
  sending: { en: 'Sending', hans: '正在发送', hant: '正在傳送', ja: '送信中', ko: '보내는 중', fr: 'Envoi', de: 'Wird gesendet' },
  code: { en: 'Six-digit code', hans: '六位数验证码', hant: '六位數驗證碼', ja: '6 桁のコード', ko: '6자리 코드', fr: 'Code à six chiffres', de: 'Sechsstelliger Code' },
  resetSentTo: { en: 'We sent a code to {email}.', hans: '验证码已发送到 {email}。', hant: '驗證碼已傳送到 {email}。', ja: '{email} にコードを送信しました。', ko: '{email}(으)로 코드를 보냈습니다.', fr: 'Nous avons envoyé un code à {email}.', de: 'Wir haben einen Code an {email} gesendet.' },
  resend: { en: 'Resend code', hans: '重新发送', hant: '重新傳送', ja: 'コードを再送信', ko: '코드 다시 보내기', fr: 'Renvoyer le code', de: 'Code erneut senden' },
  setNewPassword: { en: 'Set new password', hans: '设置新密码', hant: '設定新密碼', ja: '新しいパスワードを設定', ko: '새 비밀번호 설정', fr: 'Définir le nouveau mot de passe', de: 'Neues Passwort festlegen' },
  saving: { en: 'Saving', hans: '正在保存', hant: '正在儲存', ja: '保存中', ko: '저장 중', fr: 'Enregistrement', de: 'Wird gespeichert' },
  resetDoneTitle: { en: 'Password updated', hans: '密码已更新', hant: '密碼已更新', ja: 'パスワードを更新しました', ko: '비밀번호가 변경되었습니다', fr: 'Mot de passe mis à jour', de: 'Passwort aktualisiert' },
  resetDoneLead: {
    en: 'Sign in with your new password.',
    hans: '请使用新密码登录。',
    hant: '請使用新密碼登入。',
    ja: '新しいパスワードでサインインしてください。',
    ko: '새 비밀번호로 로그인하세요.',
    fr: 'Connectez-vous avec votre nouveau mot de passe.',
    de: 'Melden Sie sich mit Ihrem neuen Passwort an.',
  },
  changeEmail: { en: 'Use a different email', hans: '换一个邮箱', hant: '換一個電子郵件', ja: '別のメールアドレスを使う', ko: '다른 이메일 사용', fr: 'Utiliser un autre e-mail', de: 'Andere E-Mail verwenden' },
  // sign-in callback and finish
  authFailed: { en: 'Sign-in failed', hans: '登录失败', hant: '登入失敗', ja: 'サインインに失敗しました', ko: '로그인에 실패했습니다', fr: 'Échec de la connexion', de: 'Anmeldung fehlgeschlagen' },
  completing: { en: 'Completing sign in', hans: '正在完成登录', hant: '正在完成登入', ja: 'サインインを完了しています', ko: '로그인을 완료하는 중', fr: 'Finalisation de la connexion', de: 'Anmeldung wird abgeschlossen' },
  completingLead: {
    en: 'Securing your session and returning you to the BOKMOO storefront.',
    hans: '正在保护你的登录状态，并返回 BOKMOO 商店。',
    hant: '正在保護你的登入狀態，並返回 BOKMOO 商店。',
    ja: 'セッションを保護して BOKMOO ストアに戻ります。',
    ko: '세션을 보호하고 BOKMOO 스토어로 돌아갑니다.',
    fr: 'Sécurisation de votre session et retour vers la boutique BOKMOO.',
    de: 'Ihre Sitzung wird gesichert und Sie kehren zum BOKMOO-Shop zurück.',
  },
  backToSignIn: { en: 'Back to sign in', hans: '返回登录', hant: '返回登入', ja: 'サインインに戻る', ko: '로그인으로 돌아가기', fr: 'Retour à la connexion', de: 'Zurück zur Anmeldung' },
  home: { en: 'Home', hans: '首页', hant: '首頁', ja: 'ホーム', ko: '홈', fr: 'Accueil', de: 'Startseite' },
  tryAgain: { en: 'Try again', hans: '重试', hant: '重試', ja: 'もう一度試す', ko: '다시 시도', fr: 'Réessayer', de: 'Erneut versuchen' },
  unknownSignInError: {
    en: 'We could not finish signing you in. Try again, or sign in with your email.',
    hans: '没能完成登录。请重试，或改用邮箱登录。',
    hant: '沒能完成登入。請重試，或改用電子郵件登入。',
    ja: 'サインインを完了できませんでした。もう一度試すか、メールアドレスでサインインしてください。',
    ko: '로그인을 완료하지 못했습니다. 다시 시도하거나 이메일로 로그인하세요.',
    fr: 'Nous n’avons pas pu finaliser votre connexion. Réessayez ou connectez-vous avec votre e-mail.',
    de: 'Die Anmeldung konnte nicht abgeschlossen werden. Versuchen Sie es erneut oder melden Sie sich mit E-Mail an.',
  },
} as const;

/** "{brand} account" — the brand keeps its own spelling. */
export function accountLabel(locale: string | undefined, brand: string): string {
  const name = brand.toUpperCase();
  return pickCopy(locale, {
    en: `${name} account`,
    hans: `${name} 账户`,
    hant: `${name} 帳戶`,
    ja: `${name} アカウント`,
    ko: `${name} 계정`,
    fr: `Compte ${name}`,
    de: `${name}-Konto`,
  });
}

/**
 * The big headline is set large and tight for Latin letters. Chinese, Japanese and Korean glyphs
 * collide at that spacing and run long at that size, so they get a light spacing and a smaller size.
 */
export function headlineStyle(locale: string | undefined): { letterSpacing: string; fontSize: string } | undefined {
  return /^(en|fr|de)$/.test(locale || 'en')
    ? undefined
    : { letterSpacing: '-0.01em', fontSize: 'clamp(2.6rem, 5vw, 4.6rem)' };
}

export function withBrand(text: string, brand: string): string {
  return text.replace('{brand}', brand);
}

/**
 * What the shopper is told when the server refuses a sign-in or a sign-up. The server answers in English;
 * the answers shoppers meet are said in their language, anything else is passed on as it came.
 */
export function authErrorText(locale: string | undefined, message: string | null | undefined): string {
  const text = String(message || '').trim();
  if (!text) return '';
  const known: Array<[RegExp, AuthCopy | (() => string)]> = [
    [/invalid credentials|incorrect (e-?mail or )?password|wrong password/i, { en: 'Incorrect email or password.', hans: '邮箱或密码不正确。', hant: '郵箱或密碼不正確。', ja: 'メールアドレスまたはパスワードが正しくありません。', ko: '이메일 또는 비밀번호가 올바르지 않습니다.', fr: 'E-mail ou mot de passe incorrect.', de: 'E-Mail oder Passwort ist falsch.' }],
    [/already exists/i, { en: 'An account already exists for this email. Sign in instead.', hans: '该邮箱已注册，请直接登录。', hant: '該郵箱已註冊，請直接登入。', ja: 'このメールアドレスのアカウントはすでに存在します。サインインしてください。', ko: '이 이메일로 등록된 계정이 이미 있습니다. 로그인해 주세요.', fr: 'Un compte existe déjà pour cet e-mail. Connectez-vous.', de: 'Für diese E-Mail gibt es bereits ein Konto. Melden Sie sich an.' }],
    [/too many|rate limit/i, { en: 'Too many attempts. Wait a moment and try again.', hans: '尝试次数过多，请稍后再试。', hant: '嘗試次數過多，請稍後再試。', ja: '試行回数が多すぎます。しばらくしてからもう一度お試しください。', ko: '시도 횟수가 너무 많습니다. 잠시 후 다시 시도하세요.', fr: 'Trop de tentatives. Patientez un instant puis réessayez.', de: 'Zu viele Versuche. Warten Sie einen Moment und versuchen Sie es erneut.' }],
    [/required|valid e-?mail/i, { en: 'Enter a valid email and a password.', hans: '请输入有效的邮箱和密码。', hant: '請輸入有效的電子郵件和密碼。', ja: '有効なメールアドレスとパスワードを入力してください。', ko: '올바른 이메일과 비밀번호를 입력하세요.', fr: 'Saisissez un e-mail valide et un mot de passe.', de: 'Geben Sie eine gültige E-Mail und ein Passwort ein.' }],
    [/at least \d+ characters|password must/i, { en: 'Use a password of at least 8 characters.', hans: '密码至少需要 8 个字符。', hant: '密碼至少需要 8 個字元。', ja: 'パスワードは 8 文字以上にしてください。', ko: '비밀번호는 8자 이상이어야 합니다.', fr: 'Utilisez un mot de passe d’au moins 8 caractères.', de: 'Verwenden Sie ein Passwort mit mindestens 8 Zeichen.' }],
    [/network|failed to fetch|offline|timeout|load failed/i, { en: 'Could not reach the server. Check your connection and try again.', hans: '无法连接服务器，请检查网络后重试。', hant: '無法連線至伺服器，請檢查網路後重試。', ja: 'サーバーに接続できませんでした。通信状況を確認してもう一度お試しください。', ko: '서버에 연결할 수 없습니다. 연결을 확인하고 다시 시도하세요.', fr: 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.', de: 'Server nicht erreichbar. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.' }],
    [/check the code|invalid code|incorrect code|wrong code|expired/i, { en: 'That code is not right. Check it and try again.', hans: '验证码不正确，请检查后重试。', hant: '驗證碼不正確，請檢查後重試。', ja: 'コードが正しくありません。確認してもう一度お試しください。', ko: '코드가 올바르지 않습니다. 확인하고 다시 시도하세요.', fr: 'Ce code n’est pas le bon. Vérifiez-le et réessayez.', de: 'Dieser Code stimmt nicht. Prüfen Sie ihn und versuchen Sie es erneut.' }],
    [/could not (send|reset)|too many (resend|verification|password reset)/i, { en: 'The code could not be sent. Try again in a moment.', hans: '验证码没能发出去，请稍后重试。', hant: '驗證碼沒能發出去，請稍後重試。', ja: 'コードを送信できませんでした。しばらくしてからもう一度お試しください。', ko: '코드를 보내지 못했습니다. 잠시 후 다시 시도하세요.', fr: 'Le code n’a pas pu être envoyé. Réessayez dans un instant.', de: 'Der Code konnte nicht gesendet werden. Versuchen Sie es gleich noch einmal.' }],
    [/could not (send|reset)|check the code|invalid code|expired/i, { en: 'That did not work. Check the code and try again.', hans: '操作没有成功，请检查验证码后重试。', hant: '操作沒有成功，請檢查驗證碼後重試。', ja: 'できませんでした。コードを確認してもう一度お試しください。', ko: '진행할 수 없습니다. 코드를 확인하고 다시 시도하세요.', fr: 'Cela n’a pas fonctionné. Vérifiez le code et réessayez.', de: 'Das hat nicht geklappt. Prüfen Sie den Code und versuchen Sie es erneut.' }],
  ];
  for (const [pattern, copy] of known) {
    if (pattern.test(text)) return typeof copy === 'function' ? copy() : pickCopy(locale, copy);
  }
  return text;
}

/** The brand these pages speak for. */
export function authBrand(config?: ThemeConfig): string {
  return resolveBokmooSiteConfig(config).brandName;
}

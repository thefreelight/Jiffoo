import { pickCopy } from '../site';
import { cardName } from './card-copy';
import type { AuthCopy } from './auth-copy';

export type { AuthCopy as AffiliateCopy };

/**
 * Everything the affiliate workspace says, in the seven storefront languages: the partner's own
 * referral page, the application to open an organization, and the organization's member page.
 * Before, the page was written in English only, whatever language the storefront was in.
 */

export const affiliateText = (locale: string | undefined, copy: AuthCopy): string => pickCopy(locale, copy);

/** The copy with its `{name}` slots filled. */
export function fill(text: string, values: Record<string, string | number>): string {
  let filled = text;
  for (const [key, value] of Object.entries(values)) filled = filled.split(`{${key}}`).join(String(value));
  return filled;
}

export const AFFILIATE = {
  back: { en: 'Back', hans: '返回', hant: '返回', ja: '戻る', ko: '뒤로', fr: 'Retour', de: 'Zurück' },
  refresh: { en: 'Refresh', hans: '刷新', hant: '重新整理', ja: '更新', ko: '새로고침', fr: 'Actualiser', de: 'Aktualisieren' },
  signInTitle: { en: 'Affiliate workspace', hans: '推广中心', hant: '推廣中心', ja: 'アフィリエイト画面', ko: '제휴 센터', fr: 'Espace d’affiliation', de: 'Partnerbereich' },
  tabPartner: { en: 'Partner', hans: '推广伙伴', hant: '推廣夥伴', ja: 'パートナー', ko: '파트너', fr: 'Partenaire', de: 'Partner' },
  tabOrganization: { en: 'Organization', hans: '机构', hant: '機構', ja: '組織', ko: '조직', fr: 'Organisation', de: 'Organisation' },
  partnerEyebrow: { en: 'Personal affiliate', hans: '个人推广', hant: '個人推廣', ja: '個人アフィリエイト', ko: '개인 제휴', fr: 'Affiliation personnelle', de: 'Persönliche Partnerschaft' },
  partnerTitle: { en: 'Your referral earnings.', hans: '你的推荐收益。', hant: '你的推薦收益。', ja: 'あなたの紹介報酬。', ko: '나의 추천 수익.', fr: 'Vos gains de parrainage.', de: 'Ihre Empfehlungserlöse.' },
  copyLink: { en: 'Copy link', hans: '复制链接', hant: '複製連結', ja: 'リンクをコピー', ko: '링크 복사', fr: 'Copier le lien', de: 'Link kopieren' },
  copied: { en: 'Copied', hans: '已复制', hant: '已複製', ja: 'コピーしました', ko: '복사됨', fr: 'Copié', de: 'Kopiert' },
  earned: { en: 'earned', hans: '累计收益', hant: '累計收益', ja: '獲得済み', ko: '획득', fr: 'gagnés', de: 'verdient' },
  rate: { en: 'rate', hans: '佣金比例', hant: '佣金比例', ja: '報酬率', ko: '수수료율', fr: 'taux', de: 'Satz' },
  orders: { en: 'orders', hans: '订单', hant: '訂單', ja: '注文', ko: '주문', fr: 'commandes', de: 'Bestellungen' },
  appliesToAll: {
    en: 'Your code applies to every product.',
    hans: '你的推广码适用于全部商品。',
    hant: '你的推廣碼適用於全部商品。',
    ja: 'あなたのコードはすべての商品に使えます。',
    ko: '내 코드는 모든 상품에 적용됩니다.',
    fr: 'Votre code s’applique à tous les produits.',
    de: 'Ihr Code gilt für alle Produkte.',
  },
  appliesToSelected: {
    en: 'Your code applies to {products} only.',
    hans: '你的推广码仅适用于{products}。',
    hant: '你的推廣碼僅適用於{products}。',
    ja: 'あなたのコードは{products}にのみ使えます。',
    ko: '내 코드는 {products}에만 적용됩니다.',
    fr: 'Votre code ne s’applique qu’à : {products}.',
    de: 'Ihr Code gilt nur für: {products}.',
  },
  appliesToExcept: {
    en: 'Your code applies to every product except {products}.',
    hans: '你的推广码适用于全部商品，{products}除外。',
    hant: '你的推廣碼適用於全部商品，{products}除外。',
    ja: 'あなたのコードは{products}を除くすべての商品に使えます。',
    ko: '내 코드는 {products}을(를) 제외한 모든 상품에 적용됩니다.',
    fr: 'Votre code s’applique à tous les produits, sauf : {products}.',
    de: 'Ihr Code gilt für alle Produkte außer: {products}.',
  },
  productOne: { en: '1 product', hans: '1 件商品', hant: '1 件商品', ja: '1 点の商品', ko: '상품 1개', fr: '1 produit', de: '1 Produkt' },
  productCount: { en: '{count} products', hans: '{count} 件商品', hant: '{count} 件商品', ja: '{count} 点の商品', ko: '상품 {count}개', fr: '{count} produits', de: '{count} Produkte' },
  displayName: { en: 'Display name', hans: '显示名称', hant: '顯示名稱', ja: '表示名', ko: '표시 이름', fr: 'Nom affiché', de: 'Anzeigename' },
  organizationCode: { en: 'Organization code (optional)', hans: '机构代码（选填）', hant: '機構代碼（選填）', ja: '組織コード（任意）', ko: '조직 코드(선택)', fr: 'Code de l’organisation (facultatif)', de: 'Organisationscode (optional)' },
  createAccount: { en: 'Create affiliate account', hans: '创建推广账号', hant: '建立推廣帳號', ja: 'アフィリエイトアカウントを作成', ko: '제휴 계정 만들기', fr: 'Créer un compte d’affiliation', de: 'Affiliate-Konto erstellen' },
  partnerCommissions: { en: 'Partner commissions', hans: '推广佣金', hant: '推廣佣金', ja: 'パートナー報酬', ko: '파트너 수수료', fr: 'Commissions du partenaire', de: 'Partnerprovisionen' },
  organizationCommissions: { en: 'Organization commissions', hans: '机构佣金', hant: '機構佣金', ja: '組織の報酬', ko: '조직 수수료', fr: 'Commissions de l’organisation', de: 'Organisationsprovisionen' },
  noCommissions: { en: 'No commissions yet', hans: '暂无佣金', hant: '暫無佣金', ja: '報酬はまだありません', ko: '아직 수수료가 없습니다', fr: 'Aucune commission pour l’instant', de: 'Noch keine Provisionen' },
  loadFailed: { en: 'Affiliate data could not be loaded.', hans: '推广数据加载失败。', hant: '推廣資料載入失敗。', ja: 'アフィリエイト情報を読み込めませんでした。', ko: '제휴 정보를 불러오지 못했습니다.', fr: 'Les données d’affiliation n’ont pas pu être chargées.', de: 'Die Partnerdaten konnten nicht geladen werden.' },
  registerFailed: { en: 'The account could not be created.', hans: '账号创建失败。', hant: '帳號建立失敗。', ja: 'アカウントを作成できませんでした。', ko: '계정을 만들지 못했습니다.', fr: 'Le compte n’a pas pu être créé.', de: 'Das Konto konnte nicht erstellt werden.' },
  // the application to open an organization
  organizationEyebrow: { en: 'Organization affiliate', hans: '机构推广', hant: '機構推廣', ja: '組織アフィリエイト', ko: '조직 제휴', fr: 'Affiliation d’organisation', de: 'Organisations-Partnerschaft' },
  organizationTitle: { en: 'Creator network.', hans: '创作者网络。', hant: '創作者網絡。', ja: 'クリエイターネットワーク。', ko: '크리에이터 네트워크.', fr: 'Réseau de créateurs.', de: 'Creator-Netzwerk.' },
  applyIntro: {
    en: 'A creator with an audience? Leave your contact details and a screenshot of your followers to apply for an organization. Once approved, you earn a higher commission rate and a share of what the members you bring in sell.',
    hans: '如果你是大 V，可以提交联系方式和粉丝数据截图，申请开通机构。通过后可获得更高的佣金比例和二级返佣：你带来的成员出单，你也拿一份机构分成。',
    hant: '如果你是大 V，可以提交聯絡方式和粉絲數據截圖，申請開通機構。通過後可獲得更高的佣金比例和二級返傭：你帶來的成員出單，你也拿一份機構分成。',
    ja: '多くのフォロワーがいるクリエイターですか？連絡先とフォロワー数のスクリーンショットを添えて、組織の開設を申請してください。承認後はより高い報酬率と、あなたが招待したメンバーの売上に対する報酬を受け取れます。',
    ko: '팔로워가 많은 크리에이터인가요? 연락처와 팔로워 수 스크린샷을 남기고 조직 개설을 신청하세요. 승인되면 더 높은 수수료율과, 회원님이 초대한 멤버의 판매에 대한 수수료를 받습니다.',
    fr: 'Vous avez une audience ? Laissez vos coordonnées et une capture de vos abonnés pour demander une organisation. Une fois approuvée, vous touchez un taux de commission plus élevé et une part des ventes faites par les membres que vous amenez.',
    de: 'Sie haben eine Reichweite? Hinterlassen Sie Ihre Kontaktdaten und einen Screenshot Ihrer Follower und beantragen Sie eine Organisation. Nach der Freischaltung erhalten Sie einen höheren Provisionssatz und einen Anteil an dem, was die von Ihnen geworbenen Mitglieder verkaufen.',
  },
  followersScreenshot: { en: 'Followers screenshot', hans: '粉丝数据截图', hant: '粉絲數據截圖', ja: 'フォロワー数のスクリーンショット', ko: '팔로워 수 스크린샷', fr: 'Capture de vos abonnés', de: 'Follower-Screenshot' },
  followersHint: { en: 'Optional. If you have an audience, show us your followers on the platforms you use. JPEG, PNG, or WebP, up to 5 MB.', hans: '选填。如果你是大 V，可以把各平台的粉丝数据截图发给我们。支持 JPEG、PNG、WebP，最大 5 MB。', hant: '選填。如果你是大 V，可以把各平台的粉絲數據截圖發給我們。支援 JPEG、PNG、WebP，最大 5 MB。', ja: '任意。多くのフォロワーがいる場合は、利用中のプラットフォームのフォロワー数のスクリーンショットをお送りください。JPEG・PNG・WebP、5 MB まで。', ko: '선택 사항입니다. 팔로워가 많다면 사용 중인 플랫폼의 팔로워 수 스크린샷을 보내 주세요. JPEG, PNG, WebP, 최대 5 MB.', fr: 'Facultatif. Si vous avez une audience, montrez-nous vos abonnés sur vos plateformes. JPEG, PNG ou WebP, 5 Mo maximum.', de: 'Optional. Wenn Sie eine Reichweite haben, zeigen Sie uns Ihre Follower auf Ihren Plattformen. JPEG, PNG oder WebP, höchstens 5 MB.' },
  uploadScreenshot: { en: 'Upload screenshot', hans: '上传截图', hant: '上傳截圖', ja: 'スクリーンショットを送る', ko: '스크린샷 올리기', fr: 'Envoyer la capture', de: 'Screenshot hochladen' },
  replaceScreenshot: { en: 'Upload another', hans: '重新上传', hant: '重新上傳', ja: '別の画像を送る', ko: '다른 스크린샷 올리기', fr: 'Envoyer une autre capture', de: 'Anderes Bild hochladen' },
  screenshotAttached: { en: 'Screenshot sent', hans: '截图已发送', hant: '截圖已送出', ja: '送信済み', ko: '스크린샷 전송됨', fr: 'Capture envoyée', de: 'Screenshot gesendet' },
  screenshotFailed: { en: 'The screenshot could not be sent. Check the file and try again.', hans: '截图发送失败，请检查文件后重试。', hant: '截圖送出失敗，請檢查檔案後重試。', ja: 'スクリーンショットを送信できませんでした。ファイルを確認してもう一度お試しください。', ko: '스크린샷을 보내지 못했습니다. 파일을 확인하고 다시 시도하세요.', fr: 'La capture n’a pas pu être envoyée. Vérifiez le fichier et réessayez.', de: 'Das Screenshot konnte nicht gesendet werden. Prüfen Sie die Datei und versuchen Sie es erneut.' },
  signInRequired: { en: 'Sign in to see your referral link and earnings.', hans: '登录后即可查看你的推广链接和收益。', hant: '登入後即可查看你的推廣連結和收益。', ja: 'ログインすると紹介リンクと報酬を確認できます。', ko: '로그인하면 추천 링크와 수익을 확인할 수 있습니다.', fr: 'Connectez-vous pour voir votre lien de parrainage et vos gains.', de: 'Melden Sie sich an, um Ihren Empfehlungslink und Ihre Erlöse zu sehen.' },
  memberOf: { en: 'You are a member of this organization.', hans: '你是这个机构的成员。', hant: '你是這個機構的成員。', ja: 'あなたはこの組織のメンバーです。', ko: '당신은 이 조직의 멤버입니다.', fr: 'Vous êtes membre de cette organisation.', de: 'Sie sind Mitglied dieser Organisation.' },
  organizationName: { en: 'Organization name', hans: '机构名称', hant: '機構名稱', ja: '組織名', ko: '조직 이름', fr: 'Nom de l’organisation', de: 'Name der Organisation' },
  contactName: { en: 'Contact name', hans: '联系人', hant: '聯絡人', ja: '担当者名', ko: '담당자 이름', fr: 'Nom du contact', de: 'Kontaktperson' },
  phone: { en: 'Phone or WhatsApp', hans: '电话或 WhatsApp', hant: '電話或 WhatsApp', ja: '電話番号または WhatsApp', ko: '전화번호 또는 WhatsApp', fr: 'Téléphone ou WhatsApp', de: 'Telefon oder WhatsApp' },
  website: { en: 'Website or social media', hans: '网站或社交媒体主页', hant: '網站或社群媒體首頁', ja: 'ウェブサイトまたは SNS', ko: '웹사이트 또는 소셜 미디어', fr: 'Site web ou réseau social', de: 'Website oder Social Media' },
  message: { en: 'About your organization', hans: '机构介绍', hant: '機構介紹', ja: '組織の紹介', ko: '조직 소개', fr: 'À propos de votre organisation', de: 'Über Ihre Organisation' },
  submitApplication: { en: 'Submit application', hans: '提交申请', hant: '送出申請', ja: '申し込む', ko: '신청 제출', fr: 'Envoyer la demande', de: 'Antrag senden' },
  submitting: { en: 'Submitting', hans: '正在提交', hant: '正在送出', ja: '送信中', ko: '제출 중', fr: 'Envoi', de: 'Wird gesendet' },
  applyFailed: { en: 'The application could not be sent.', hans: '申请提交失败。', hant: '申請送出失敗。', ja: '申し込みを送信できませんでした。', ko: '신청을 제출하지 못했습니다.', fr: 'La demande n’a pas pu être envoyée.', de: 'Der Antrag konnte nicht gesendet werden.' },
  pendingTitle: { en: 'Application under review', hans: '申请审核中', hant: '申請審核中', ja: '申請を審査中です', ko: '신청 검토 중', fr: 'Demande en cours d’examen', de: 'Antrag in Prüfung' },
  pendingBody: {
    en: 'We received your application for “{name}” and will get back to you at {email}.',
    hans: '我们已收到「{name}」的申请，会通过 {email} 与你联系。',
    hant: '我們已收到「{name}」的申請，會透過 {email} 與你聯絡。',
    ja: '「{name}」の申請を受け付けました。{email} にご連絡します。',
    ko: '「{name}」 신청을 접수했습니다. {email}(으)로 연락드리겠습니다.',
    fr: 'Nous avons bien reçu votre demande pour « {name} » et vous répondrons à {email}.',
    de: 'Wir haben Ihren Antrag für „{name}“ erhalten und melden uns unter {email}.',
  },
  rejectedTitle: { en: 'Application not approved', hans: '申请未通过', hant: '申請未通過', ja: '申請は承認されませんでした', ko: '신청이 승인되지 않았습니다', fr: 'Demande non approuvée', de: 'Antrag nicht genehmigt' },
  reviewNote: {
    en: 'Note from us: {note}',
    hans: '我们的回复：{note}',
    hant: '我們的回覆：{note}',
    ja: 'こちらからのメッセージ：{note}',
    ko: '답변: {note}',
    fr: 'Notre réponse : {note}',
    de: 'Unsere Rückmeldung: {note}',
  },
  applyAgain: { en: 'Apply again', hans: '重新申请', hant: '重新申請', ja: 'もう一度申し込む', ko: '다시 신청', fr: 'Faire une nouvelle demande', de: 'Erneut beantragen' },
  statusPending: { en: 'Pending', hans: '审核中', hant: '審核中', ja: '審査中', ko: '검토 중', fr: 'En attente', de: 'Offen' },
  statusApproved: { en: 'Approved', hans: '已通过', hant: '已通過', ja: '承認済み', ko: '승인됨', fr: 'Approuvée', de: 'Genehmigt' },
  submittedAt: { en: 'Submitted', hans: '提交时间', hant: '提交時間', ja: '申請日時', ko: '신청일', fr: 'Envoyée le', de: 'Eingereicht am' },
  rejectedBody: {
    en: 'You can send a new application whenever you like.',
    hans: '你可以随时重新提交申请。',
    hant: '你可以隨時重新送出申請。',
    ja: 'いつでももう一度申し込めます。',
    ko: '언제든지 다시 신청할 수 있습니다.',
    fr: 'Vous pouvez envoyer une nouvelle demande quand vous le souhaitez.',
    de: 'Sie können jederzeit einen neuen Antrag stellen.',
  },
  // the organization itself
  organizationRate: { en: '{rate}% organization rate', hans: '机构佣金比例 {rate}%', hant: '機構佣金比例 {rate}%', ja: '組織の報酬率 {rate}%', ko: '조직 수수료율 {rate}%', fr: 'Taux de l’organisation : {rate} %', de: 'Organisationssatz: {rate} %' },
  members: { en: 'Members', hans: '成员', hant: '成員', ja: 'メンバー', ko: '멤버', fr: 'Membres', de: 'Mitglieder' },
  memberEmail: { en: 'Member email', hans: '成员邮箱', hant: '成員電子郵件', ja: 'メンバーのメールアドレス', ko: '멤버 이메일', fr: 'E-mail du membre', de: 'E-Mail des Mitglieds' },
  roleOwner: { en: 'Owner', hans: '所有者', hant: '擁有者', ja: 'オーナー', ko: '소유자', fr: 'Propriétaire', de: 'Inhaber' },
  roleInfluencer: { en: 'Creator', hans: '创作者', hant: '創作者', ja: 'クリエイター', ko: '크리에이터', fr: 'Créateur', de: 'Creator' },
  roleManager: { en: 'Manager', hans: '管理员', hant: '管理員', ja: 'マネージャー', ko: '관리자', fr: 'Gestionnaire', de: 'Manager' },
  addMember: { en: 'Add', hans: '添加', hant: '新增', ja: '追加', ko: '추가', fr: 'Ajouter', de: 'Hinzufügen' },
  memberFailed: { en: 'The member could not be added.', hans: '成员添加失败。', hant: '成員新增失敗。', ja: 'メンバーを追加できませんでした。', ko: '멤버를 추가하지 못했습니다.', fr: 'Le membre n’a pas pu être ajouté.', de: 'Das Mitglied konnte nicht hinzugefügt werden.' },
  commissionPending: { en: 'Pending', hans: '待结算', hant: '待結算', ja: '確定待ち', ko: '지급 대기', fr: 'En attente', de: 'Offen' },
  commissionPaid: { en: 'Paid', hans: '已支付', hant: '已支付', ja: '支払済み', ko: '지급 완료', fr: 'Payée', de: 'Ausgezahlt' },
  commissionReversed: { en: 'Reversed', hans: '已撤销', hant: '已撤銷', ja: '取り消し', ko: '취소됨', fr: 'Annulée', de: 'Storniert' },
} as const;

/** What a partner's code applies to, in words. The store's own cards are named; anything else is counted. */
export function scopeText(
  locale: string | undefined,
  partner: { scopeMode?: string | null; scopeProductIds?: string[] | null } | null | undefined,
): string {
  const mode = partner?.scopeMode === 'selected' || partner?.scopeMode === 'except' ? partner.scopeMode : 'all';
  if (mode === 'all') return affiliateText(locale, AFFILIATE.appliesToAll);
  const ids = partner?.scopeProductIds ?? [];
  const names = ids.map((id) => cardName({ id }, locale));
  const separator = /^(zh|ja|ko)/.test(locale || 'en') ? '、' : ', ';
  const list = names.length && names.every((name): name is string => Boolean(name))
    ? (names as string[]).join(separator)
    : ids.length === 1
      ? affiliateText(locale, AFFILIATE.productOne)
      : affiliateText(locale, AFFILIATE.productCount).replace('{count}', String(ids.length));
  return fill(affiliateText(locale, mode === 'selected' ? AFFILIATE.appliesToSelected : AFFILIATE.appliesToExcept), { products: list });
}

export function memberRoleText(locale: string | undefined, role: string | null | undefined): string {
  const value = String(role || '').toUpperCase();
  if (value === 'OWNER') return affiliateText(locale, AFFILIATE.roleOwner);
  if (value === 'MANAGER') return affiliateText(locale, AFFILIATE.roleManager);
  return affiliateText(locale, AFFILIATE.roleInfluencer);
}

export function commissionStatusText(locale: string | undefined, status: string | null | undefined): string {
  const value = String(status || '').toLowerCase();
  if (value === 'paid') return affiliateText(locale, AFFILIATE.commissionPaid);
  if (value === 'reversed') return affiliateText(locale, AFFILIATE.commissionReversed);
  return affiliateText(locale, AFFILIATE.commissionPending);
}

/**
 * What the shopper is told when the server refuses an application, a registration or a member. The
 * server answers in English with an error code; the answers shoppers meet are said in their language,
 * and anything unknown is passed on as it came.
 */
export function affiliateErrorText(
  locale: string | undefined,
  cause: { code?: string | null; message?: string | null } | null | undefined,
): string {
  const code = String(cause?.code || '').toUpperCase();
  const text = String(cause?.message || '').trim();
  const say = (copy: AuthCopy) => affiliateText(locale, copy);
  if (code === 'USER_ALREADY_ORGANIZED') {
    return say({ en: 'This account already belongs to an organization.', hans: '该账户已属于一个机构。', hant: '該帳戶已屬於一個機構。', ja: 'このアカウントはすでに組織に所属しています。', ko: '이 계정은 이미 조직에 속해 있습니다.', fr: 'Ce compte appartient déjà à une organisation.', de: 'Dieses Konto gehört bereits zu einer Organisation.' });
  }
  if (code === 'SIGN_IN_REQUIRED') return say(AFFILIATE.signInRequired);
  if (code === 'INVALID_FILE_TYPE') {
    return say({ en: 'Screenshots must be JPEG, PNG, or WebP images.', hans: '截图必须是 JPEG、PNG 或 WebP 图片。', hant: '截圖必須是 JPEG、PNG 或 WebP 圖片。', ja: 'スクリーンショットは JPEG・PNG・WebP の画像にしてください。', ko: '스크린샷은 JPEG, PNG, WebP 이미지여야 합니다.', fr: 'Les captures doivent être des images JPEG, PNG ou WebP.', de: 'Screenshots müssen JPEG-, PNG- oder WebP-Bilder sein.' });
  }
  if (code === 'FILE_TOO_LARGE') {
    return say({ en: 'The screenshot must be at most 5 MB.', hans: '截图不能超过 5 MB。', hant: '截圖不能超過 5 MB。', ja: 'スクリーンショットは 5 MB までにしてください。', ko: '스크린샷은 5 MB 이하여야 합니다.', fr: 'La capture ne doit pas dépasser 5 Mo.', de: 'Das Screenshot darf höchstens 5 MB groß sein.' });
  }
  if (code === 'APPLICATION_PENDING') return say(AFFILIATE.pendingTitle);
  if (code === 'OWNER_ROLE_IMMUTABLE') {
    return say({ en: 'The owner is already a member of the organization.', hans: '所有者已经是机构成员。', hant: '擁有者已經是機構成員。', ja: 'オーナーはすでに組織のメンバーです。', ko: '소유자는 이미 조직의 멤버입니다.', fr: 'Le propriétaire est déjà membre de l’organisation.', de: 'Der Inhaber ist bereits Mitglied der Organisation.' });
  }
  if (code === 'USER_NOT_FOUND') {
    return say({ en: 'No account matches that email. An account is needed before joining.', hans: '没有找到使用该邮箱的账户。对方需要先注册账户。', hant: '找不到使用該電子郵件的帳戶。對方需要先註冊帳戶。', ja: 'そのメールアドレスのアカウントが見つかりません。参加するには先にアカウントが必要です。', ko: '해당 이메일의 계정을 찾을 수 없습니다. 먼저 계정을 만들어야 합니다.', fr: 'Aucun compte ne correspond à cet e-mail. Un compte est nécessaire pour rejoindre l’organisation.', de: 'Zu dieser E-Mail gibt es kein Konto. Zum Beitritt wird ein Konto benötigt.' });
  }
  if (code === 'ORGANIZATION_MEMBERSHIP_REQUIRED') {
    return say({ en: 'Join the organization before registering as its affiliate.', hans: '加入机构后，才能登记为该机构的推广伙伴。', hant: '加入機構後，才能登記為該機構的推廣夥伴。', ja: 'その組織のアフィリエイトとして登録するには、先に組織に参加してください。', ko: '해당 조직의 제휴 파트너로 등록하려면 먼저 조직에 참여하세요.', fr: 'Rejoignez l’organisation avant de vous inscrire comme son affilié.', de: 'Treten Sie der Organisation bei, bevor Sie sich als ihr Partner registrieren.' });
  }
  if (code === 'VALIDATION_ERROR') {
    if (/organization name/i.test(text)) {
      return say({ en: 'Enter the organization’s name.', hans: '请填写机构名称。', hant: '請填寫機構名稱。', ja: '組織名を入力してください。', ko: '조직 이름을 입력하세요.', fr: 'Saisissez le nom de l’organisation.', de: 'Geben Sie den Namen der Organisation ein.' });
    }
    if (/e-?mail/i.test(text)) {
      return say({ en: 'Enter a valid email.', hans: '请输入有效的邮箱。', hant: '請輸入有效的電子郵件。', ja: '有効なメールアドレスを入力してください。', ko: '올바른 이메일을 입력하세요.', fr: 'Saisissez un e-mail valide.', de: 'Geben Sie eine gültige E-Mail ein.' });
    }
    return say({ en: 'Check what you entered and try again.', hans: '请检查填写的内容后重试。', hant: '請檢查填寫的內容後重試。', ja: '入力内容を確認してもう一度お試しください。', ko: '입력한 내용을 확인하고 다시 시도하세요.', fr: 'Vérifiez ce que vous avez saisi et réessayez.', de: 'Prüfen Sie Ihre Eingaben und versuchen Sie es erneut.' });
  }
  return text;
}

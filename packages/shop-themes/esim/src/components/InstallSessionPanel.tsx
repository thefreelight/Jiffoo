import React from 'react';
import { Copy, QrCode, Smartphone } from 'lucide-react';
import type { EsimInstallSession } from '../lib/api';
import qrcodegen from '../lib/qrcodegen';
import { type ThemeCopy, pickCopy } from '../site';
import { planTitle } from '../lib/esim/catalog';

function copyToClipboard(value: string) {
  if (!value || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
  navigator.clipboard.writeText(value).catch(() => undefined);
}

type InstallSessionPanelProps = {
  session: EsimInstallSession;
  className?: string;
  title?: string;
  locale?: string;
};

function getQrImageSrc(value?: string): string | null {
  if (!value) return null;
  if (/^data:image\//i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

/** Render an LPA/QR payload as a scannable inline SVG (no backend image needed). */
function QrSvg({ payload }: { payload: string }) {
  const rendered = React.useMemo(() => {
    try {
      const { QrCode: QrEncoder } = qrcodegen;
      const qr = QrEncoder.encodeText(payload, QrEncoder.Ecc.MEDIUM);
      const modules: string[] = [];
      for (let y = 0; y < qr.size; y += 1) {
        for (let x = 0; x < qr.size; x += 1) {
          if (qr.getModule(x, y)) modules.push(`M${x} ${y}h1v1h-1z`);
        }
      }
      return { path: modules.join(''), size: qr.size };
    } catch {
      return null;
    }
  }, [payload]);
  if (!rendered) return null;
  return (
    <svg
      aria-label="eSIM install QR code"
      role="img"
      viewBox={`0 0 ${rendered.size} ${rendered.size}`}
      className="h-full w-full"
      shapeRendering="crispEdges"
    >
      <rect width={rendered.size} height={rendered.size} fill="#ffffff" />
      <path d={rendered.path} fill="#111111" />
    </svg>
  );
}

function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent || '');
}

export const InstallSessionPanel = React.memo(function InstallSessionPanel({
  session,
  className = '',
  title,
  locale,
}: InstallSessionPanelProps) {
  const tr = (copy: ThemeCopy) => pickCopy(locale, copy);
  const qrImageSrc = getQrImageSrc(session.qrCode);
  const qrPayload = session.lpaString || session.qrCode || '';
  const scannableQr = qrPayload && !getQrImageSrc(qrPayload);
  const showQr = Boolean(session.status === 'ready' || session.status === 'installed' || qrImageSrc || session.lpaString);
  const fields = [
    [tr({ en: 'SM-DP+ address', hans: 'SM-DP+ 地址', hant: 'SM-DP+ 位址' }), session.smdpAddress || '—'],
    [tr({ en: 'Matching ID', hans: '匹配码', hant: '配對碼' }), session.matchingId || '—'],
    [tr({ en: 'Activation code', hans: '激活码', hant: '啟用碼' }), session.activationCode || '—'],
    [tr({ en: 'Confirmation code', hans: '确认码', hant: '確認碼' }), session.confirmationCode || '—'],
  ];
  const android = isAndroidDevice();

  const statusBanner = (() => {
    const iccidTail = session.iccid ? `····${session.iccid.slice(-6)}` : '';
    switch (session.status) {
      case 'pending_payment':
        return tr({
          en: 'Complete payment to provision this eSIM.',
          hans: '完成支付后自动开通此 eSIM。',
          hant: '完成支付後自動開通此 eSIM。',
        });
      case 'processing':
        return tr({
          en: 'Provisioning in progress — this page updates when the package is ready.',
          hans: '开通处理中——套餐就绪后本页即可安装。',
          hant: '開通處理中——套餐就緒後本頁即可安裝。',
        });
      case 'installed':
        // A top-up lands on an existing profile, so there is nothing new to
        // install — unless the buyer never installed that profile in the
        // first place. With the first-install code on hand, say both.
        return qrPayload
          ? tr({
              en: `Package added to your eSIM${iccidTail ? ` ${iccidTail}` : ''}. Not installed this eSIM yet? Scan below to set it up — skip this if it is already on your phone.`,
              hans: `套餐已加到你的 eSIM${iccidTail ? ` ${iccidTail}` : ''}。这张 eSIM 还没装到手机？扫下方二维码安装；已经装过可以忽略。`,
              hant: `套餐已加到你的 eSIM${iccidTail ? ` ${iccidTail}` : ''}。這張 eSIM 還沒裝到手機？掃下方二維碼安裝；已經裝過可以忽略。`,
              ja: `プランをあなたの eSIM${iccidTail ? ` ${iccidTail}` : ''}に追加しました。この eSIM をまだインストールしていない場合は、下の QR コードをスキャンして設定してください。すでにスマートフォンに入っている場合はそのままで構いません。`,
              ko: `요금제가 회원님의 eSIM${iccidTail ? ` ${iccidTail}` : ''}에 추가되었습니다. 이 eSIM을 아직 설치하지 않으셨나요? 아래 QR 코드를 스캔해 설정하세요. 이미 휴대폰에 있다면 건너뛰어도 됩니다.`,
              fr: `Forfait ajouté à votre eSIM${iccidTail ? ` ${iccidTail}` : ''}. Vous n'avez pas encore installé cet eSIM ? Scannez le code ci-dessous pour le configurer — inutile s'il est déjà sur votre téléphone.`,
              de: `Paket zu Ihrer eSIM${iccidTail ? ` ${iccidTail}` : ''} hinzugefügt. Diese eSIM noch nicht installiert? Scannen Sie unten zum Einrichten — falls sie schon auf Ihrem Telefon ist, überspringen Sie diesen Schritt.`,
            })
          : tr({
              en: `Package added to your eSIM${iccidTail ? ` ${iccidTail}` : ''} — no new install needed. Not installed it yet? The install code is on the order that first issued this eSIM.`,
              hans: `套餐已加到你的 eSIM${iccidTail ? ` ${iccidTail}` : ''}——无需重新安装。如果还没装过，安装码在首次开通这张 eSIM 的那笔订单里。`,
              hant: `套餐已加到你的 eSIM${iccidTail ? ` ${iccidTail}` : ''}——無需重新安裝。如果還沒裝過，安裝碼在首次開通這張 eSIM 的那筆訂單裡。`,
              ja: `プランをあなたの eSIM${iccidTail ? ` ${iccidTail}` : ''}に追加しました。再インストールは不要です。まだインストールしていない場合は、この eSIM を最初に発行した注文にインストールコードが記載されています。`,
              ko: `요금제가 회원님의 eSIM${iccidTail ? ` ${iccidTail}` : ''}에 추가되었습니다. 다시 설치할 필요가 없습니다. 아직 설치하지 않으셨다면 이 eSIM을 처음 발급한 주문에서 설치 코드를 확인하세요.`,
              fr: `Forfait ajouté à votre eSIM${iccidTail ? ` ${iccidTail}` : ''} — rien à réinstaller. Pas encore installé ? Le code d'installation se trouve sur la commande qui a émis cet eSIM.`,
              de: `Paket zu Ihrer eSIM${iccidTail ? ` ${iccidTail}` : ''} hinzugefügt — keine Neuinstallation nötig. Noch nicht installiert? Den Installationscode finden Sie in der Bestellung, mit der diese eSIM ausgestellt wurde.`,
            });
      case 'failed':
        return tr({
          en: 'Provisioning failed — our support team has been notified and will follow up.',
          hans: '开通失败——客服团队已收到通知并将跟进处理。',
          hant: '開通失敗——客服團隊已收到通知並將跟進處理。',
        });
      case 'expired':
        return tr({
          en: 'This install code has expired — contact support to reissue it.',
          hans: '安装码已过期——请联系客服重新签发。',
          hant: '安裝碼已過期——請聯繫客服重新簽發。',
        });
      default:
        return null;
    }
  })();

  return (
    <div
      className={`rounded-[1.1rem] border border-[var(--esim-line)] bg-[var(--esim-bg)] p-4 text-left ${className}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-[color:color-mix(in_oklab,var(--esim-gold)_10%,transparent)] text-[var(--esim-gold)]">
          <QrCode className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--esim-ink)]">
            {title ?? tr({ en: 'Install your eSIM', hans: '安装你的 eSIM', hant: '安裝你的 eSIM' })}
          </p>
          <p className="mt-1 text-xs text-[var(--esim-copy-soft)]">{planTitle(session.defaultCode, session.packageTitle, locale)}</p>
        </div>
      </div>

      {statusBanner ? (
        <p className="mt-3 rounded-[0.9rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-gold)_7%,transparent)] px-3 py-2 text-xs leading-5 text-[var(--esim-copy)]">
          {statusBanner}
        </p>
      ) : null}

      {session.iccid ? (
        <p className="mt-3 text-xs text-[var(--esim-copy-soft)]">
          {tr({ en: 'eSIM ICCID', hans: 'eSIM ICCID', hant: 'eSIM ICCID' })}: {session.iccid}
        </p>
      ) : null}

      {showQr && qrPayload ? (
        <div className="mt-4 rounded-[1rem] border border-[var(--esim-line)] bg-[linear-gradient(160deg,color-mix(in_oklab,var(--esim-gold)_9%,transparent),transparent_52%),var(--esim-bg-elevated)] p-4">
          <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[0.9rem] border border-[var(--esim-line)] bg-white p-2">
              {qrImageSrc ? (
                <img src={qrImageSrc} alt="BOKMOO eSIM install QR code" className="h-full w-full object-contain" />
              ) : scannableQr ? (
                <QrSvg payload={qrPayload} />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-[var(--esim-copy)]">
                  <QrCode className="h-11 w-11 text-[var(--esim-gold)]" />
                  <span className="text-xs leading-5">
                    {tr({ en: 'QR payload ready', hans: '安装码已就绪', hant: '安裝碼已就緒' })}
                  </span>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--esim-ink)]">
                {session.status === 'installed'
                  ? tr({ en: 'Install this eSIM', hans: '安装这张 eSIM', hant: '安裝這張 eSIM' })
                  : tr({ en: 'Scan or install manually', hans: '扫码安装或手动输入', hant: '掃碼安裝或手動輸入' })}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--esim-copy)]">
                {session.status === 'installed'
                  ? tr({
                      en: 'Needed once per phone — the package is already on the eSIM and activates right after install.',
                      hans: '每台手机只需装一次——套餐已经在你的 eSIM 上，装好即生效。',
                      hant: '每台手機只需裝一次——套餐已經在你的 eSIM 上，裝好即生效。',
                    })
                  : tr({
                      en: 'iPhone: point the camera at the QR code. Other phones: Settings → Network → Add eSIM.',
                      hans: 'iPhone：相机对准二维码即可。其他手机：设置 → 网络 → 添加 eSIM。',
                      hant: 'iPhone：相機對準二維碼即可。其他手機：設定 → 網路 → 加入 eSIM。',
                    })}
              </p>
              {android && session.lpaString && session.status !== 'pending_payment' ? (
                <button
                  onClick={() => {
                    window.location.href = session.lpaString || '';
                  }}
                  className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-[0.8rem] border border-[var(--esim-line)] bg-[color:color-mix(in_oklab,var(--esim-gold)_12%,transparent)] px-4 text-sm font-medium text-[var(--esim-ink)]"
                  type="button"
                >
                  <Smartphone className="h-4 w-4 text-[var(--esim-gold)]" />
                  {tr({ en: 'One-tap install (Android)', hans: '一键安装到本机（Android）', hant: '一鍵安裝到本機（Android）' })}
                </button>
              ) : null}
              <div>
                <button
                  onClick={() => copyToClipboard(qrPayload)}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-[0.8rem] border border-[var(--esim-line)] px-4 text-sm font-medium text-[var(--esim-ink)]"
                  type="button"
                >
                  <Copy className="h-4 w-4 text-[var(--esim-gold)]" />
                  {tr({ en: 'Copy activation code', hans: '复制安装码', hant: '複製安裝碼' })}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {fields.map(([label, value]) => (
          <div
            key={`${label}-${value}`}
            className="flex items-center justify-between gap-3 rounded-[0.9rem] border border-[var(--esim-line)] px-3 py-3"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--esim-copy-soft)]">{label}</p>
              <p className="mt-1 text-sm text-[var(--esim-ink)]">{value}</p>
            </div>
            {value !== '—' ? (
              <button
                onClick={() => copyToClipboard(String(value))}
                className="text-[var(--esim-gold)]"
                type="button"
              >
                <Copy className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      {session.lpaString ? (
        <div className="mt-3 rounded-[0.9rem] border border-[var(--esim-line)] px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--esim-copy-soft)]">
                {tr({ en: 'LPA string', hans: 'LPA 安装串', hant: 'LPA 安裝字串' })}
              </p>
              <p className="mt-1 break-all text-sm text-[var(--esim-ink)]">{session.lpaString}</p>
            </div>
            <button
              onClick={() => copyToClipboard(session.lpaString || '')}
              className="text-[var(--esim-gold)]"
              type="button"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {session.instructions?.ios?.length || session.instructions?.android?.length || session.instructions?.general?.length ? (
        <div className="mt-4 space-y-3">
          {session.instructions?.ios?.length ? (
            <div className="rounded-[0.9rem] border border-[var(--esim-line)] px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--esim-copy-soft)]">iOS</p>
              <ul className="mt-2 space-y-2 text-sm text-[var(--esim-copy)]">
                {session.instructions.ios.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {session.instructions?.android?.length ? (
            <div className="rounded-[0.9rem] border border-[var(--esim-line)] px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--esim-copy-soft)]">Android</p>
              <ul className="mt-2 space-y-2 text-sm text-[var(--esim-copy)]">
                {session.instructions.android.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {session.instructions?.general?.length ? (
            <div className="rounded-[0.9rem] border border-[var(--esim-line)] px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--esim-copy-soft)]">
                {tr({ en: 'General Notes', hans: '通用说明', hant: '通用說明' })}
              </p>
              <ul className="mt-2 space-y-2 text-sm text-[var(--esim-copy)]">
                {session.instructions.general.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {session.support?.email || session.support?.phone ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--esim-copy)]">
          {session.support?.email ? (
            <a className="inline-flex items-center gap-2 text-[var(--esim-ink)] underline" href={`mailto:${session.support.email}`}>
              {session.support.email}
            </a>
          ) : null}
          {session.support?.phone ? (
            <a className="inline-flex items-center gap-2 text-[var(--esim-ink)] underline" href={`tel:${session.support.phone}`}>
              {session.support.phone}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

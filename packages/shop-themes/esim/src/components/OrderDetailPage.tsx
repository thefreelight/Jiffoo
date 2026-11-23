import React from 'react';
import { ArrowLeft, Copy, ExternalLink, PackageCheck, ShieldCheck } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { OrderDetailPageProps } from 'shared/src/types/theme';
import { getEsimInstallSession, getEsimOrder, getOrderIdFromLocation, mapEsimApiOrderToThemeOrder, normalizeInstallSession, type EsimInstallSession } from '../lib/api';
import { InstallSessionPanel } from './InstallSessionPanel';
import { extractDeliverySections, getDeliveredArtifactCount } from '../lib/digital-fulfillment';
import { formatOrderDate, itemStatusLabel, orderStatusLabel, statusTone } from '../lib/esim/order-copy';
import { planTitle } from '../lib/esim/catalog';
import { type ThemeCopy, pickCopy, resolveEsimSiteConfig } from '../site';

function copyToClipboard(value: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
  navigator.clipboard.writeText(value).catch(() => undefined);
}

function renderField(label: string, value: string, action?: React.ReactNode) {
  return (
    <div className="rounded-[var(--esim-radius-md)] border border-[var(--esim-line)] bg-[var(--esim-bg)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--esim-copy-soft)]">{label}</p>
        {action}
      </div>
      <p className="mt-3 break-all text-sm font-semibold text-[var(--esim-ink)]">{value}</p>
    </div>
  );
}

export const OrderDetailPage = React.memo(function OrderDetailPage({
  order,
  isLoading,
  config,
  onBack,
  onBackToOrders,
  onCancelOrder,
  locale,
}: OrderDetailPageProps) {
  const handleBack = onBack || onBackToOrders;
  const site = resolveEsimSiteConfig(config);
  const t = (copy: ThemeCopy) => pickCopy(locale, copy);
  const [remoteOrder, setRemoteOrder] = React.useState<OrderDetailPageProps['order']>(null);
  const [installSession, setInstallSession] = React.useState<EsimInstallSession | null>(null);
  const effectiveOrder = order || remoteOrder;

  React.useEffect(() => {
    if (order?.id) return;

    const orderId = getOrderIdFromLocation();
    if (!orderId) return;

    let cancelled = false;

    void getEsimOrder(
      {
        baseUrl: site.apiBaseUrl,
      },
      orderId
    )
      .then((response) => {
        if (!cancelled) {
          setRemoteOrder(mapEsimApiOrderToThemeOrder(response));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [order?.id, site.apiBaseUrl]);

  React.useEffect(() => {
    if (!effectiveOrder?.id) return;

    let cancelled = false;

    void getEsimInstallSession(
        {
          baseUrl: site.apiBaseUrl,
        },
        effectiveOrder.id
      )
      .then((session) => {
        if (!cancelled) {
          setInstallSession(session);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [effectiveOrder?.id, site.apiBaseUrl]);

  if (isLoading) {
    return <div className="min-h-screen bg-[var(--esim-bg)]" />;
  }

  if (!effectiveOrder) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--esim-bg)] px-4">
        <div className="rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-surface)] p-10 text-center shadow-[var(--esim-shadow)]">
          <h1 className="text-3xl font-black tracking-[-0.04em] text-[var(--esim-ink)]">
            {t({ en: 'Order not found', hans: '找不到订单', hant: '找不到訂單' })}
          </h1>
          {handleBack ? (
            <button
              onClick={handleBack}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--esim-primary)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {t({ en: 'Back to orders', hans: '返回订单列表', hant: '返回訂單列表' })}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const artifactCount = effectiveOrder.items.reduce(
    (sum, item) => sum + getDeliveredArtifactCount(item.fulfillmentData),
    0
  );

  return (
    <div className="min-h-screen bg-[var(--esim-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        {handleBack ? (
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--esim-line)] bg-[var(--esim-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--esim-copy)]"
          >
            <ArrowLeft className="h-4 w-4" />
            {t({ en: 'Back to orders', hans: '返回订单列表', hant: '返回訂單列表' })}
          </button>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(20rem,0.7fr)]">
          <section className="space-y-4">
            <div className="rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-surface)] p-6 shadow-[var(--esim-shadow)] sm:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em]', statusTone(effectiveOrder.status))}>
                      {orderStatusLabel(effectiveOrder.status, locale)}
                    </span>
                    {/* Only meaningful when the order carries deliverable content — an eSIM order's install panel replaces it. */}
                    {artifactCount > 0 ? (
                      <span className="rounded-full border border-[var(--esim-line)] px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-[var(--esim-copy)]">
                        {t({ en: `${artifactCount} delivered item${artifactCount === 1 ? '' : 's'}`, hans: `已交付 ${artifactCount} 项内容`, hant: `已交付 ${artifactCount} 項內容`, ja: `${artifactCount} 件のコンテンツを発行済み`, ko: `${artifactCount}개 콘텐츠 발급됨`, fr: `${artifactCount} contenu${artifactCount === 1 ? '' : 's'} livré${artifactCount === 1 ? '' : 's'}`, de: `${artifactCount} Inhalt${artifactCount === 1 ? '' : 'e'} zugestellt`})}
                      </span>
                    ) : null}
                  </div>
                  <h1 className="mt-5 text-[clamp(2.2rem,4vw,4rem)] font-black tracking-[-0.05em] text-[var(--esim-ink)]">
                    {t({ en: 'Order', hans: '订单', hant: '訂單' })} #{effectiveOrder.id.slice(-8).toUpperCase()}
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-[var(--esim-copy)]">
                    {t(
                      { en: 'Placed', hans: '下单于', hant: '下單於' },
                    )} {formatOrderDate(effectiveOrder.createdAt, locale)} · {t({ en: 'Payment', hans: '支付状态', hant: '付款狀態' })} {orderStatusLabel(effectiveOrder.paymentStatus, locale)}
                  </p>
                </div>
                {onCancelOrder && ['PENDING', 'PAID'].includes(effectiveOrder.status.toUpperCase()) ? (
                  <button
                    onClick={() => onCancelOrder()}
                    className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--esim-line)] bg-[var(--esim-bg)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--esim-copy)]"
                  >
                    {t({ en: 'Cancel order', hans: '取消订单', hant: '取消訂單' })}
                  </button>
                ) : null}
              </div>
            </div>

            {installSession ? (
              <InstallSessionPanel
                title={t({ en: 'Install your eSIM', hans: '安装你的 eSIM', hant: '安裝你的 eSIM' })}
                session={installSession}
                locale={locale}
                className="border-[var(--esim-line)] bg-[var(--esim-bg)]"
              />
            ) : null}

            {effectiveOrder.shipments?.length ? (
              <section className="rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-surface)] p-6 shadow-[var(--esim-shadow)] sm:p-8">
                <div className="flex items-start gap-3"><PackageCheck className="mt-1 h-5 w-5 shrink-0 text-[var(--esim-primary)]" /><div><h2 className="text-2xl font-black tracking-[-0.04em] text-[var(--esim-ink)]">{t({ en: 'Delivery tracking', hans: '物流跟踪', hant: '物流追蹤' })}</h2><p className="mt-2 text-sm leading-6 text-[var(--esim-copy)]">{t({ en: 'Your carrier and tracking updates appear here after dispatch.', hans: '发货后，承运商与物流动态会显示在这里。', hant: '出貨後，承運商與物流動態會顯示在這裡。' })}</p></div></div>
                <div className="mt-6 grid gap-4">
                  {effectiveOrder.shipments.map((shipment) => (
                    <div key={shipment.id} className="rounded-[var(--esim-radius-md)] border border-[var(--esim-line)] bg-[var(--esim-bg)] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--esim-copy-soft)]">{shipment.carrierName || shipment.carrier}{shipment.carrierCode ? ` · ${shipment.carrierCode}` : ''}</p><p className="mt-2 break-all font-mono text-sm font-semibold text-[var(--esim-ink)]">{shipment.trackingNumber}</p></div><span className={cn('rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]', statusTone(shipment.status))}>{orderStatusLabel(shipment.status, locale)}</span></div>
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--esim-copy)]">{shipment.shippedAt ? <span>{t({ en: 'Shipped', hans: '发货于', hant: '出貨於' })} {formatOrderDate(shipment.shippedAt, locale, false)}</span> : null}{shipment.deliveredAt ? <span>{t({ en: 'Delivered', hans: '签收于', hant: '簽收於' })} {formatOrderDate(shipment.deliveredAt, locale, false)}</span> : null}{shipment.trackingUrl ? <a href={shipment.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--esim-primary-strong)] underline underline-offset-4">{t({ en: 'Track package', hans: '查看物流', hant: '查看物流' })} <ExternalLink className="h-3.5 w-3.5" /></a> : null}</div>
                      {shipment.events?.length ? <ol className="mt-5 border-l border-[var(--esim-line-strong)] pl-4">{shipment.events.map((event: { status: string; description?: string | null; occurredAt: string }, eventIndex: number) => <li key={`${event.status}-${event.occurredAt}-${eventIndex}`} className="relative pb-4 last:pb-0"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[var(--esim-primary)] ring-4 ring-[var(--esim-bg)]" /><div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"><p className="text-xs font-semibold text-[var(--esim-ink)]">{orderStatusLabel(event.status, locale)}</p><time className="text-[11px] text-[var(--esim-copy-soft)]" dateTime={event.occurredAt}>{formatOrderDate(event.occurredAt, locale)}</time></div>{event.description ? <p className="mt-1 text-xs leading-5 text-[var(--esim-copy)]">{event.description}</p> : null}</li>)}</ol> : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {effectiveOrder.items.map((item) => {
              const sections = extractDeliverySections(item.fulfillmentData);
              // A BOSS plan's variant repeats the catalog product name (Chinese); only a real option is worth showing.
              const variantDetail = item.variantName && item.variantName.trim() !== String(item.productName || '').trim() ? item.variantName : null;
              // eSIM items are installed through the panel above; their
              // fulfillmentData.esimIccid is the internal reuse target, not a
              // deliverable to list here (it used to surface as "Esim Iccid").
              const isEsimItem = typeof item.productId === 'string' && item.productId.startsWith('boss-');
              const installLike = (() => {
                const data = item.fulfillmentData as (Partial<EsimInstallSession> & Record<string, unknown>) | null | undefined;
                if (!data || typeof data !== 'object') return null;
                if (
                  !(
                    'qrCode' in data ||
                    'qr_code' in data ||
                    'qrCodeContent' in data ||
                    'qr_code_content' in data ||
                    'lpaString' in data ||
                    'lpa' in data ||
                    'lpa_string' in data ||
                    'smdpAddress' in data ||
                    'smdp_address' in data ||
                    'smdp' in data ||
                    'matchingId' in data ||
                    'matching_id' in data ||
                    'activationCode' in data ||
                    'activation_code' in data
                  )
                ) {
                  return null;
                }
                return normalizeInstallSession({
                  ...data,
                  orderId: effectiveOrder.id,
                  orderNumber: effectiveOrder.id,
                  status: 'ready',
                  packageTitle: planTitle(item.productId, item.productName, locale),
                });
              })();
              const hasContent =
                sections.codes.length +
                  sections.credentials.length +
                  sections.links.length +
                  sections.meta.length +
                  sections.notes.length >
                0;

              return (
                <article
                  key={item.id}
                  className="rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-surface)] p-6 shadow-[var(--esim-shadow)] sm:p-8"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--esim-copy-soft)]">
                        {t({ en: 'Item delivery', hans: '商品交付', hant: '商品交付' })}
                      </p>
                      <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[var(--esim-ink)]">
                        {planTitle(item.productId, item.productName, locale)}
                      </h2>
                      <p className="mt-2 text-sm text-[var(--esim-copy)]">
                        {t({ en: 'Qty', hans: '数量', hant: '數量' })} {item.quantity}{variantDetail ? ` · ${variantDetail}` : ''}
                      </p>
                    </div>
                    <span className={cn('rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em]', statusTone(item.fulfillmentStatus || effectiveOrder.status))}>
                      {itemStatusLabel(item.fulfillmentStatus || effectiveOrder.status, locale)}
                    </span>
                  </div>

                  {isEsimItem ? (
                    installSession ? (
                      <p className="mt-6 text-sm leading-6 text-[var(--esim-copy)]">
                        {t({
                          en: 'Provisioned automatically — your install details are shown above.',
                          hans: '自动开通，安装信息见上方。',
                          hant: '自動開通，安裝資訊見上方。',
                        })}
                      </p>
                    ) : null
                  ) : hasContent ? (
                    <div className="mt-6 grid gap-4">
                      {installLike ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {[
                            [t({ en: 'SM-DP+ address', hans: 'SM-DP+ 地址', hant: 'SM-DP+ 位址' }), installLike.smdpAddress || '—'],
                            [t({ en: 'Matching ID', hans: '匹配码', hant: '配對碼' }), installLike.matchingId || '—'],
                            [t({ en: 'Activation code', hans: '激活码', hant: '啟用碼' }), installLike.activationCode || '—'],
                            [t({ en: 'Confirmation code', hans: '确认码', hant: '確認碼' }), installLike.confirmationCode || '—'],
                          ].map(([label, value]) => (
                            <div key={`${label}-${value}`}>
                              {renderField(
                                label,
                                String(value),
                                value !== '—' ? (
                                  <button
                                    onClick={() => copyToClipboard(String(value))}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--esim-primary)]"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    {t({ en: 'Copy', hans: '复制', hant: '複製' })}
                                  </button>
                                ) : undefined
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {sections.codes.length ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {sections.codes.map((field) => (
                            <div key={`${item.id}-${field.label}-${field.value}`}>
                              {renderField(
                                field.label,
                                field.value,
                                <button
                                  onClick={() => copyToClipboard(field.value)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--esim-primary)]"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  {t({ en: 'Copy', hans: '复制', hant: '複製' })}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {sections.credentials.length ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {sections.credentials.map((field) => (
                            <div key={`${item.id}-${field.label}-${field.value}`}>
                              {renderField(
                                field.label,
                                field.value,
                                <button
                                  onClick={() => copyToClipboard(field.value)}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--esim-primary)]"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  {t({ en: 'Copy', hans: '复制', hant: '複製' })}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {sections.links.length ? (
                        <div className="grid gap-3">
                          {sections.links.map((field) =>
                            renderField(
                              field.label,
                              field.value,
                              <a
                                href={field.href}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--esim-primary)]"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                {t({ en: 'Open', hans: '打开', hant: '開啟' })}
                              </a>
                            )
                          )}
                        </div>
                      ) : null}

                      {sections.meta.length ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {sections.meta.map((field) => (
                            <div key={`${item.id}-${field.label}-${field.value}`}>
                              {renderField(field.label, field.value)}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {sections.notes.length ? (
                        <div className="rounded-[var(--esim-radius-md)] border border-[var(--esim-line)] bg-[var(--esim-bg)] p-5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--esim-copy-soft)]">
                            {t({ en: 'Notes', hans: '备注', hant: '備註' })}
                          </p>
                          <div className="mt-3 space-y-2">
                            {sections.notes.map((note) => (
                              <p key={note} className="text-sm leading-6 text-[var(--esim-copy)]">
                                {note}
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-[var(--esim-radius-md)] border border-dashed border-[var(--esim-line)] bg-[var(--esim-bg)] p-5 text-sm leading-6 text-[var(--esim-copy)]">
                      {t({
                        en: 'This order is still waiting for fulfillment details. Refresh later or reopen it from the order archive.',
                        hans: '该订单的交付信息还在生成中，请稍后刷新，或从订单记录中重新打开。',
                        hant: '該訂單的交付資訊還在產生中，請稍後重新整理，或從訂單紀錄中重新開啟。',
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </section>

          <aside className="space-y-4">
            <div className="rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-surface)] p-6 shadow-[var(--esim-shadow)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[var(--esim-primary-soft)] text-[var(--esim-primary)]">
                  <PackageCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy-soft)]">
                    {t({ en: 'Order total', hans: '订单合计', hant: '訂單合計' })}
                  </p>
                  <p className="mt-1 text-3xl font-black tracking-[-0.04em] text-[var(--esim-ink)]">
                    ${Number(effectiveOrder.totalAmount || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm text-[var(--esim-copy)]">
                <div className="flex items-center justify-between">
                  <span>{t({ en: 'Currency', hans: '币种', hant: '幣別' })}</span>
                  <span className="font-semibold text-[var(--esim-ink)]">{effectiveOrder.currency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t({ en: 'Payment', hans: '支付状态', hant: '付款狀態' })}</span>
                  <span className="font-semibold text-[var(--esim-ink)]">{orderStatusLabel(effectiveOrder.paymentStatus, locale)}</span>
                </div>
                {effectiveOrder.cancelReason ? (
                  <div className="rounded-[var(--esim-radius-md)] border border-[var(--esim-line)] bg-[var(--esim-bg)] p-4">
                    <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--esim-copy-soft)]">
                      {t({ en: 'Cancel reason', hans: '取消原因', hant: '取消原因' })}
                    </p>
                    <p className="mt-2 text-sm text-[var(--esim-copy)]">{effectiveOrder.cancelReason}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-surface)] p-6 shadow-[var(--esim-shadow)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[var(--esim-primary-soft)] text-[var(--esim-primary)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy-soft)]">
                    {t({ en: 'Keep it safe', hans: '安全提示', hant: '安全提示' })}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--esim-copy)]">
                    {t({
                      en: 'Keep a copy of any sensitive credentials in your own password manager or secure notes after claiming the order.',
                      hans: '领取后，请把激活码等敏感信息保存到你自己的密码管理器或安全笔记中。',
                      hant: '領取後，請把啟用碼等敏感資訊保存到你自己的密碼管理器或安全筆記中。',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
});

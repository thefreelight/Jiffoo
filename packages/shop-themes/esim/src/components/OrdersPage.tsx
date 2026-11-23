import React from 'react';
import { ArrowRight, Clock3, Package2, ShieldCheck } from 'lucide-react';
import { cn } from '@jiffoo/ui';
import type { OrdersPageProps } from 'shared/src/types/theme';
import { EsimApiError, getEsimOrders, mapEsimApiOrderToThemeOrder } from '../lib/api';
import { getDeliveredArtifactCount } from '../lib/digital-fulfillment';
import { formatOrderDate, orderStatusLabel, statusTone } from '../lib/esim/order-copy';
import { pickCopy, resolveEsimSiteConfig } from '../site';

export const OrdersPage = React.memo(function OrdersPage({
  orders,
  isLoading,
  error,
  currentPage,
  totalPages,
  config,
  onPageChange,
  onOrderClick,
  onCancelOrder,
  locale,
}: OrdersPageProps) {
  const site = resolveEsimSiteConfig(config);
  const t = (copy: { en: string; hans: string; hant: string }) => pickCopy(locale, copy);

  const [remoteOrders, setRemoteOrders] = React.useState<OrdersPageProps['orders']>([]);
  const [remoteTotalPages, setRemoteTotalPages] = React.useState(1);
  const [remoteLoading, setRemoteLoading] = React.useState(false);
  const [remoteError, setRemoteError] = React.useState('');

  React.useEffect(() => {
    if (orders.length > 0) return;

    let cancelled = false;
    setRemoteLoading(true);
    setRemoteError('');

    void getEsimOrders(
      {
        baseUrl: site.apiBaseUrl,
      },
      {
        page: currentPage || 1,
        limit: 10,
      }
    )
      .then((response) => {
        if (cancelled) return;
        setRemoteOrders(response.items.map(mapEsimApiOrderToThemeOrder));
        setRemoteTotalPages(Math.max(1, Math.ceil(Number(response.total || response.items.length || 0) / 10)));
      })
      .catch((loadError) => {
        if (cancelled) return;
        // Only surface a reason the server actually gave; anything else
        // (network blip) is reported in the storefront's own words.
        const message = loadError instanceof EsimApiError ? loadError.message : t({ en: 'Unable to load orders.', hans: '订单加载失败，请稍后重试。', hant: '訂單載入失敗，請稍後重試。' });
        setRemoteError(message);
        setRemoteOrders([]);
        setRemoteTotalPages(1);
      })
      .finally(() => {
        if (!cancelled) {
          setRemoteLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentPage, orders.length, site.apiBaseUrl]);

  const effectiveOrders = remoteOrders.length > 0 ? remoteOrders : orders;
  const displayError = error || remoteError;
  const displayTotalPages = remoteOrders.length > 0 ? remoteTotalPages : totalPages;

  if (isLoading || (remoteLoading && effectiveOrders.length === 0)) {
    return <div className="min-h-screen bg-[var(--esim-bg)]" />;
  }

  return (
    <div className="min-h-screen bg-[var(--esim-bg)] px-4 pb-16 pt-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <section className="rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-surface)] p-6 shadow-[var(--esim-shadow)] sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--esim-line)] bg-[var(--esim-bg)] px-4 py-2 text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy)]">
                <ShieldCheck className="h-4 w-4 text-[var(--esim-primary)]" />
                {t({ en: 'Order archive', hans: '订单档案', hant: '訂單檔案' })}
              </div>
              <h1 className="mt-5 text-[clamp(2.2rem,5vw,4.2rem)] font-black leading-[0.94] tracking-[-0.05em] text-[var(--esim-ink)]">
                {t({ en: 'Every purchase stays readable after checkout.', hans: '每笔订单在结算后都可随时回看。', hant: '每筆訂單在結帳後都可隨時回看。' })}
              </h1>
            </div>
            <div className="rounded-[var(--esim-radius-md)] border border-[var(--esim-line)] bg-[var(--esim-bg)] px-4 py-3 text-sm text-[var(--esim-copy)]">
              {t({ en: 'Keep status, delivery details, and activation notes visible after checkout.', hans: '结算后仍可查看状态、配送详情与激活备注。', hant: '結帳後仍可查看狀態、配送詳情與啟用備註。' })}
            </div>
          </div>
        </section>

        {displayError ? (
          <div className="mt-6 rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-surface)] p-8 text-[var(--esim-copy)] shadow-[var(--esim-shadow)]">
            {displayError}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4">
          {effectiveOrders.length === 0 ? (
            <div className="rounded-[var(--esim-radius-lg)] border border-dashed border-[var(--esim-line)] bg-[var(--esim-surface)] p-16 text-center text-[var(--esim-copy)]">
              {t({ en: 'No travel orders yet.', hans: '还没有旅行订单。', hant: '還沒有旅行訂單。' })}
            </div>
          ) : (
            effectiveOrders.map((order) => {
              const artifactCount = order.items.reduce(
                (sum, item) => sum + getDeliveredArtifactCount(item.fulfillmentData),
                0
              );
              const canCancel = Boolean(onCancelOrder) && ['PENDING', 'PAID'].includes(order.status.toUpperCase());
              return (
                <article
                  key={order.id}
                  className="rounded-[var(--esim-radius-lg)] border border-[var(--esim-line)] bg-[var(--esim-surface)] p-5 shadow-[var(--esim-shadow)]"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.16em]', statusTone(order.status))}>
                          {orderStatusLabel(order.status, locale)}
                        </span>
                        {/* Only meaningful when the order carries deliverable content. */}
                        {artifactCount > 0 ? (
                          <span className="rounded-full border border-[var(--esim-line)] px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-[var(--esim-copy)]">
                            {t({ en: artifactCount === 1 ? '1 delivered item' : `${artifactCount} delivered items`, hans: `${artifactCount} 项已交付内容`, hant: `${artifactCount} 項已交付內容` })}
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-4 text-2xl font-black tracking-[-0.04em] text-[var(--esim-ink)]">
                        {t({ en: 'Order', hans: '订单', hant: '訂單' })} #{order.id.slice(-8).toUpperCase()}
                      </h2>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--esim-copy)]">
                        <span className="inline-flex items-center gap-2">
                          <Clock3 className="h-4 w-4" />
                          {formatOrderDate(order.createdAt, locale)}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Package2 className="h-4 w-4" />
                          {order.items.length} {t({ en: order.items.length === 1 ? 'item' : 'items', hans: '件商品', hant: '件商品' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="rounded-[var(--esim-radius-md)] border border-[var(--esim-line)] bg-[var(--esim-bg)] px-4 py-3 text-right">
                        <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--esim-copy-soft)]">
                          {t({ en: 'Total', hans: '总计', hant: '總計' })}
                        </p>
                        <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--esim-ink)]">
                          ${Number(order.totalAmount || 0).toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => onOrderClick(order.id)}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--esim-primary)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
                      >
                        {t({ en: 'Open order', hans: '查看订单', hant: '查看訂單' })}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      {canCancel ? (
                        <button
                          onClick={() => onCancelOrder(order.id)}
                          className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--esim-line)] bg-[var(--esim-surface)] px-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--esim-copy)]"
                        >
                          {t({ en: 'Cancel order', hans: '取消订单', hant: '取消訂單' })}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>

        {displayTotalPages > 1 ? (
          <div className="mt-10 flex items-center justify-center gap-3">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="rounded-full border border-[var(--esim-line)] bg-[var(--esim-surface)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--esim-copy)] disabled:opacity-40"
            >
              {t({ en: 'Previous', hans: '上一页', hant: '上一頁' })}
            </button>
            <span className="rounded-full border border-[var(--esim-line)] bg-[var(--esim-surface)] px-5 py-3 text-[11px] font-semibold tracking-[0.18em] text-[var(--esim-copy)]">
              {t({ en: 'Page', hans: '第', hant: '第' })} {currentPage} / {displayTotalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(displayTotalPages, currentPage + 1))}
              disabled={currentPage >= displayTotalPages}
              className="rounded-full border border-[var(--esim-line)] bg-[var(--esim-surface)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--esim-copy)] disabled:opacity-40"
            >
              {t({ en: 'Next', hans: '下一页', hant: '下一頁' })}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
});

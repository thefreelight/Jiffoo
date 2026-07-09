/**
 * Order Success Page Component
 * Supports both physical and digital goods delivery display.
 */

import React from 'react';
import { CheckCircle, Package, Mail, ArrowRight, Download, Key, QrCode, Truck } from 'lucide-react';
import type { OrderSuccessPageProps } from '../../../../shared/src/types/theme';

type FulfillmentItem = {
  productName: string;
  fulfillmentStatus: string | null;
  fulfillmentData: Record<string, unknown> | null;
};

function hasDigitalDelivery(items?: Array<{ fulfillmentData?: Record<string, unknown> | null }>): boolean {
  if (!items) return false;
  return items.some(item => {
    if (!item.fulfillmentData) return false;
    const data = item.fulfillmentData;
    return Boolean(
      data.qrCodeContent || data.cardUid || data.planId ||
      data.downloadUrl || data.redemptionCode || data.productCode ||
      data.productClass === 'esim' || data.productClass === 'card' || data.productClass === 'data'
    );
  });
}

function getDigitalItems(items?: Array<{ productName: string; fulfillmentStatus: string | null; fulfillmentData: Record<string, unknown> | null }>): FulfillmentItem[] {
  if (!items) return [];
  return items.filter(item => {
    if (!item.fulfillmentData) return false;
    const data = item.fulfillmentData;
    return Boolean(
      data.qrCodeContent || data.cardUid || data.planId ||
      data.downloadUrl || data.redemptionCode || data.productCode
    );
  });
}

export function OrderSuccessPage({
  orderNumber,
  order,
  config,
  onContinueShopping,
  onViewOrders,
}: OrderSuccessPageProps) {
  const digitalItems = getDigitalItems(order?.items);
  const hasDigital = digitalItems.length > 0;
  const hasPhysical = !hasDigital; // Simplified: if no digital items, show physical flow

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto text-center">
          {/* Success Icon */}
          <div className="mb-8">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle className="h-12 w-12 sm:h-14 sm:w-14 text-green-600 dark:text-green-400" />
            </div>
          </div>

          {/* Title */}
          <div className="mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-full mb-4">
              <div className="w-2 h-2 bg-green-600 dark:text-green-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest">ORDER CONFIRMED</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
              {hasDigital ? 'Your Digital Purchases Are Ready' : 'Order Successful!'}
            </h1>
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              {hasDigital ? 'ACCESS YOUR DELIVERY BELOW' : 'THANK YOU FOR YOUR PURCHASE'}
            </p>
          </div>

          {/* Digital Delivery Section */}
          {hasDigital && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-green-100 dark:border-green-800 p-6 sm:p-8 mb-6 sm:mb-8 text-left">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-4 w-1 bg-green-600 rounded-full" />
                <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  DIGITAL DELIVERY
                </h2>
              </div>

              <div className="space-y-4">
                {digitalItems.map((item, index) => (
                  <DigitalDeliveryCard key={index} item={item} />
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    A delivery confirmation with your access details has been sent to your email.
                    You can also access your purchases anytime from the Orders page.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Order Details */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8 mb-6 sm:mb-8">
            <div className="text-center mb-6 sm:mb-8">
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">ORDER NUMBER</p>
              <p className="text-2xl sm:text-3xl font-bold font-mono text-gray-900 dark:text-white">{orderNumber}</p>
            </div>

            <div className="space-y-4 text-left">
              <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-100 dark:border-green-800">
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1">PAYMENT PROCESSED</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Your payment has been successfully processed</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1">CONFIRMATION SENT</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {hasDigital
                      ? 'Delivery details sent to your email'
                      : 'Order confirmation email sent to your inbox'}
                  </p>
                </div>
              </div>

              {/* Only show tracking info for physical orders */}
              {hasPhysical && (
                <div className="flex items-start gap-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-100 dark:border-yellow-800">
                  <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                    <Package className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1">TRACKING INFO</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Tracking information will be sent to your email</p>
                  </div>
                </div>
              )}
            </div>

            {/* Only show estimated delivery for physical orders */}
            {hasPhysical && (
              <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gray-50 dark:bg-slate-700/50 rounded-2xl border border-gray-100 dark:border-slate-600">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">ESTIMATED DELIVERY</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">3-5 BUSINESS DAYS</span>
                </div>
              </div>
            )}
          </div>

          {/* What's Next */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sm:p-8 mb-6 sm:mb-8">
            <div className="flex items-center gap-2 mb-6 sm:mb-8 justify-center">
              <div className="h-4 w-1 bg-blue-600 rounded-full" />
              <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">WHAT'S NEXT</h2>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4 text-left">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">1</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1">ORDER CONFIRMATION</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">You'll receive an email confirmation shortly</p>
                </div>
              </div>

              <div className="flex items-start gap-4 text-left">
                <div className="w-10 h-10 bg-yellow-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">2</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1">
                    {hasDigital ? 'ACCESS YOUR PURCHASE' : 'PROCESSING'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {hasDigital
                      ? 'Your digital delivery is available above and in your email'
                      : "We'll prepare your order for shipment"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 text-left">
                <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">3</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wider mb-1">
                    {hasDigital ? 'ENJOY' : 'SHIPPING'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {hasDigital
                      ? 'Your purchase is ready to use — check your email for details'
                      : "Your order will be shipped and you'll get tracking info"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onContinueShopping}
              className="h-12 px-8 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 dark:shadow-none bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center gap-2"
            >
              CONTINUE SHOPPING
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              onClick={onViewOrders}
              className="h-12 px-8 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold text-sm text-gray-700 dark:text-gray-300 transition-all uppercase tracking-wider"
            >
              VIEW ORDERS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Digital Delivery Card Component
// ============================================================

function DigitalDeliveryCard({ item }: { item: FulfillmentItem }) {
  const data = item.fulfillmentData || {};
  const productClass = (data.productClass as string) || '';
  const isEsim = productClass === 'esim' || Boolean(data.qrCodeContent);
  const isCard = productClass === 'card' || Boolean(data.cardUid);
  const isDownload = Boolean(data.downloadUrl);

  return (
    <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-2xl border border-gray-100 dark:border-slate-600">
      {/* Product Name */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
          {isEsim ? <QrCode className="h-5 w-5 text-green-600 dark:text-green-400" /> :
           isCard ? <Key className="h-5 w-5 text-green-600 dark:text-green-400" /> :
           isDownload ? <Download className="h-5 w-5 text-green-600 dark:text-green-400" /> :
           <Package className="h-5 w-5 text-green-600 dark:text-green-400" />}
        </div>
        <div className="flex-1 text-left">
          <p className="font-bold text-sm text-gray-900 dark:text-white">{item.productName}</p>
          <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">
            {item.fulfillmentStatus === 'delivered' ? 'DELIVERED' : 'PROCESSING'}
          </p>
        </div>
      </div>

      {/* eSIM QR Code */}
      {isEsim && Boolean(data.qrCodeContent) && (
        <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-600">
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">QR CODE</p>
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 bg-white border border-gray-200 rounded-lg flex items-center justify-center p-1">
              <QrCodeDisplay content={data.qrCodeContent as string} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Scan this QR code to activate your eSIM</p>
              {Boolean(data.planId) && (
                <p className="text-[10px] font-mono text-gray-500 dark:text-gray-500">Plan: {String(data.planId)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Redemption Code / Card UID */}
      {isCard && Boolean(data.cardUid) && (
        <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-600">
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">REDEMPTION CODE</p>
          <div className="flex items-center justify-between gap-2">
            <code className="text-sm font-mono font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-700 px-3 py-2 rounded-lg flex-1 break-all">
              {String(data.cardUid)}
            </code>
            <CopyButton text={String(data.cardUid)} />
          </div>
        </div>
      )}

      {/* Download Link */}
      {isDownload && Boolean(data.downloadUrl) && (
        <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-600">
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">DOWNLOAD</p>
          <a
            href={String(data.downloadUrl)}
            download
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all w-fit"
          >
            <Download className="h-4 w-4" />
            Download File
          </a>
        </div>
      )}

      {/* Product Code (generic) */}
      {!isEsim && !isCard && !isDownload && Boolean(data.productCode) && (
        <div className="mt-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-600">
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">PRODUCT CODE</p>
          <code className="text-sm font-mono font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-700 px-3 py-2 rounded-lg block break-all">
            {String(data.productCode)}
          </code>
        </div>
      )}
    </div>
  );
}

// QR Code placeholder (uses inline SVG for simplicity)
function QrCodeDisplay({ content }: { content: string }) {
  // Simple QR-like visual placeholder — in production, use a QR library
  return (
    <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-400 text-center break-all">
      QR
    </div>
  );
}

// Copy to clipboard button
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  return (
    <button
      onClick={() => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }}
      className="px-3 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 transition-all flex-shrink-0"
    >
      {copied ? 'COPIED!' : 'COPY'}
    </button>
  );
}

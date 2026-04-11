'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  ArrowRight,
  Receipt,
  ShoppingBag,
  Clock,
  Mail,
  QrCode,
  Smartphone,
  Info,
  ShieldCheck,
  Zap,
  Globe,
  Sparkles,
  ArrowLeft,
  Loader2,
  Copy,
  ExternalLink
} from 'lucide-react';
import { ordersApi, cartApi, type OrderDetail, type OrderItem } from '../../../lib/api';
import {
  formatVariantNameWithBillingPeriod,
  parseESimFulfillmentData,
  type ESimFulfillmentData
} from '../../../lib/esim';
import { DataPlanUsage } from '../../../components/DataPlanUsage';
import { Button } from '../../../ui/Button';
import { cn } from '../../../lib/utils';

export default function OrderSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'en';
  const orderId = searchParams.get('orderId');

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState(30); // Increased countdown for better reading

  // Fetch order details
  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) {
        setIsLoading(false);
        return;
      }

      try {
        const orderData = await ordersApi.getOrder(orderId);
        setOrder(orderData);

        // Clear cart after successful order
        try {
          await cartApi.clearCart();
          // Trigger cart update event to refresh header
          window.dispatchEvent(new Event('cart-updated'));
        } catch (err) {
          console.error('Failed to clear cart:', err);
        }
      } catch (err) {
        console.error('FAILED TO FETCH ORDER PROTOCOL:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrder();
  }, [orderId]);

  // Auto redirect countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // router.push(`/${locale}/orders`); // Disabled auto-redirect to let user see the QR
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [locale, router]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  const isESimProduct = (fulfillmentData: any): boolean => {
    if (!fulfillmentData) return false;
    return fulfillmentData.productType === 'esim' ||
      fulfillmentData.productClass === 'esim' ||
      !!fulfillmentData.qrCodeContent;
  };

  return (
    <div className="min-h-screen bg-background pb-40 transition-colors duration-300">
      <section className="relative overflow-hidden">
        {/* Success Particles Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-muted blur-[120px] rounded-none animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-muted blur-[150px] rounded-none animate-bounce" style={{ animationDuration: '10s' }} />
        </div>

        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            {/* Mission Accomplished Icon */}
            <div className="mb-12 relative inline-block group">
              <div className="absolute inset-0 bg-muted blur-2xl group-hover: transition-opacity animate-pulse" />
              <div className="relative w-32 h-32 rounded-none bg-muted flex items-center justify-center text-foreground rotate-3 group-hover:rotate-0 transition-transform duration-500">
                <ShieldCheck className="w-16 h-16" />
              </div>
              <div className="absolute -top-4 -right-4 w-12 h-12 rounded-none bg-muted flex items-center justify-center animate-bounce">
                <Sparkles className="w-6 h-6 text-foreground" />
              </div>
            </div>

            {/* Success Header */}
            <div className="mb-16">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-8 h-[2px] bg-muted" />
                <span className="text-xs font-black uppercase tracking-[0.4em] text-foreground italic">Access Granted</span>
                <div className="w-8 h-[2px] bg-muted" />
              </div>
              <h1 className="text-6xl lg:text-7xl font-black text-muted-foreground uppercase italic tracking-tighter mb-6 leading-none">
                Authorization <br /> <span className="text-primary italic">Successful</span>
              </h1>
              <p className="text-xl text-muted-foreground font-black uppercase tracking-widest italic leading-relaxed max-w-xl mx-auto">
                Asset transfer protocols initiated. Your global connectivity is being Provisioned.
              </p>
              {orderId && (
                <div className="mt-10 inline-flex items-center gap-4 px-8 py-4 bg-muted rounded-none border border-border group hover:border-foreground transition-all cursor-pointer" onClick={() => handleCopy(orderId)}>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground italic">Protocol ID:</span>
                  <code className="text-sm font-black text-muted-foreground font-mono tracking-tighter group-hover:text-foreground transition-colors uppercase">{orderId}</code>
                  <Copy className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              )}
            </div>

            {/* Assets List (Fulfillment) */}
            <div className="space-y-12 mb-20">
              {isLoading ? (
                <div className="bg-muted rounded-none border-2 border-dashed border-border p-20 flex flex-col items-center gap-6 animate-pulse">
                  <Loader2 className="w-12 h-12 text-foreground animate-spin" />
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground italic">Syncing Asset Data...</p>
                </div>
              ) : order && order.items && order.items.length > 0 ? (
                order.items.map((item: OrderItem, index: number) => {
                  const fulfillmentData = parseESimFulfillmentData(item.fulfillmentData);
                  const variantDisplayName = formatVariantNameWithBillingPeriod(
                    item.variantName,
                    item.variantAttributes
                  );
                  // Check if this is an eSIM product
                  const isESim = isESimProduct(item.fulfillmentData);
                  // Handle qrCodeContent from Odoo
                  const qrCodeContent = (item.fulfillmentData as any)?.qrCodeContent;
                  const qrCodeUrl = qrCodeContent
                    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrCodeContent)}`
                    : fulfillmentData?.qrCode;

                  return (
                    <div key={item.id || index} className="bg-muted rounded-none border border-border p-12 lg:p-16 text-left relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none group-hover:rotate-12 transition-transform duration-700">
                        <Globe className="w-64 h-64" />
                      </div>

                      <div className="flex flex-col lg:flex-row gap-12 lg:items-start relative z-10">
                        <div className="lg:w-1/2">
                          <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-none bg-background flex items-center justify-center text-foreground border border-border">
                              <Zap className="w-6 h-6" />
                            </div>
                            <div>
                              <span className="block text-[10px] font-black uppercase tracking-[0.3em] text-foreground italic mb-1">Active Payload</span>
                              <h3 className="text-2xl font-black text-muted-foreground uppercase italic tracking-tight">{item.productName}</h3>
                              {variantDisplayName && (
                                <p className="mt-1 text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
                                  {variantDisplayName}
                                </p>
                              )}
                            </div>
                          </div>

                          {item.fulfillmentStatus === 'delivered' && fulfillmentData ? (
                            <div className="space-y-8">
                              {/* QR Scan Section - Only show for eSIM products */}
                              {isESim && qrCodeUrl && (
                                <div className="p-8 bg-background rounded-none text-foreground border border-border relative group/qr overflow-hidden flex flex-col items-center">
                                  <div className="absolute inset-0 bg-muted/50 blur-3xl rounded-none scale-150 pointer-events-none" />
                                  <div className="relative z-10 w-full">
                                    <div className="flex items-center justify-between mb-8">
                                      <div className="flex items-center gap-2">
                                        <QrCode className="w-6 h-6 text-foreground" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">Neural Sync Required</span>
                                      </div>
                                      <ShieldCheck className="w-5 h-5 text-muted-foreground" />
                                    </div>

                                    <div className="bg-muted p-6 rounded-none mb-8 group-hover/qr:scale-[1.02] transition-transform border border-border">
                                      <img src={qrCodeUrl} alt="Neural Link" className="w-full max-w-[240px] aspect-square mx-auto object-contain" />
                                    </div>

                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-foreground italic text-center">Scan with native optic sensor (Camera)</p>
                                  </div>
                                </div>
                              )}

                              {/* Non-eSIM delivery message */}
                              {!isESim && (
                                <div className="p-8 bg-background rounded-none text-foreground border border-border flex flex-col items-center text-center gap-4">
                                  <CheckCircle2 className="w-12 h-12 text-primary" />
                                  <div>
                                    <h4 className="text-lg font-black text-muted-foreground uppercase italic tracking-tighter mb-2">Order Confirmed</h4>
                                    <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest italic leading-relaxed">Your order has been confirmed. Check your email for details.</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : item.fulfillmentStatus === 'processing' ? (
                            <div className="p-12 bg-warning-50/50 rounded-none border border-warning-100 flex flex-col items-center text-center gap-6">
                              <div className="relative">
                                <Loader2 className="w-16 h-16 text-warning-500 animate-spin" />
                                <Clock className="w-6 h-6 text-warning-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                              </div>
                              <div>
                                <h4 className="text-lg font-black text-warning-900 uppercase italic tracking-tighter mb-2">Protocol Processing</h4>
                                <p className="text-sm text-warning-700 font-bold uppercase tracking-widest italic leading-relaxed">System is finalizing activation codes. Usually completes in 120-180 seconds.</p>
                              </div>
                            </div>
                          ) : (
                            <div className="p-12 bg-muted rounded-none border border-border flex flex-col items-center text-center gap-6">
                              <div className="w-16 h-16 bg-background rounded-none border border-border flex items-center justify-center text-muted-foreground">
                                <Mail className="w-8 h-8" />
                              </div>
                              <div>
                                <h4 className="text-lg font-black text-muted-foreground uppercase italic tracking-tighter mb-2">Transmission Dispatched</h4>
                                <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest italic leading-relaxed">Full activation credentials have been transmitted to your primary neural address (Email).</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Installation Specs */}
                        <div className="lg:w-1/2 space-y-8">
                          {item.fulfillmentStatus === 'delivered' && (
                            <>
                              {/* LPA from Odoo or fulfillmentData - Only show for eSIM */}
                              {isESim && (qrCodeContent || fulfillmentData?.lpa) && (
                                <div className="space-y-4">
                                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground italic ml-4">Manual Input Profile</span>
                                  <div className="space-y-3">
                                    <div className="bg-background p-6 rounded-none border border-border group/item hover:border-foreground transition-all">
                                      <div className="flex justify-between items-center mb-2">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground italic">SM-DP+ Address</span>
                                        <button onClick={() => handleCopy(qrCodeContent || fulfillmentData?.lpa || '')} className="text-[9px] font-black text-foreground uppercase italic hover:underline">Copy Link</button>
                                      </div>
                                      <code className="text-xs font-black text-muted-foreground font-mono tracking-tighter uppercase break-all">{qrCodeContent || fulfillmentData?.lpa}</code>
                                    </div>
                                    {fulfillmentData?.activationCode && (
                                      <div className="bg-background p-6 rounded-none border border-border hover:border-foreground transition-all">
                                        <div className="flex justify-between items-center mb-2">
                                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground italic">Auth Token</span>
                                          <button onClick={() => handleCopy(fulfillmentData.activationCode || '')} className="text-[9px] font-black text-foreground uppercase italic hover:underline">Copy Code</button>
                                        </div>
                                        <code className="text-sm font-black text-muted-foreground font-mono tracking-tighter uppercase">{fulfillmentData.activationCode}</code>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {isESim && fulfillmentData?.instructions?.general && (
                                <div className="space-y-4">
                                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground italic ml-4">Operational Steps</span>
                                  <div className="space-y-3">
                                    {fulfillmentData.instructions.general.map((step, i) => (
                                      <div key={i} className="flex gap-4 items-start bg-muted p-4 rounded-none border border-border">
                                        <div className="w-6 h-6 shrink-0 rounded-none bg-background text-foreground border border-border flex items-center justify-center text-[10px] font-black italic">
                                          {i + 1}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-[0.05em] italic leading-tight pt-1">{step}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {!isESim && item.fulfillmentStatus === 'delivered' && (
                            <div className="h-full flex flex-col justify-center items-center p-12 bg-background rounded-none border border-border text-center">
                              <CheckCircle2 className="w-10 h-10 text-foreground mb-4" />
                              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest italic">Your order details have been sent to your email.</p>
                            </div>
                          )}

                          {!fulfillmentData && !isESim && (
                            <div className="h-full flex flex-col justify-center items-center p-12 bg-background rounded-none border border-border border-dashed text-center">
                              <Info className="w-10 h-10 text-muted-foreground mb-4" />
                              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest italic">Check protocol logs in your email for activation fallback methods.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Data Plan Usage - Only for eSIM products */}
                      {isESim && (item.fulfillmentData as any)?.planId && (
                        <div className="mt-8">
                          <DataPlanUsage
                            planId={(item.fulfillmentData as any).planId}
                            installationId={(item.fulfillmentData as any).installationId}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-20 bg-muted rounded-none border border-border flex flex-col items-center text-center gap-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none group-hover:-rotate-12 transition-transform duration-700">
                    <Mail className="w-64 h-64" />
                  </div>
                  <div className="w-24 h-24 rounded-none bg-background border border-border flex items-center justify-center text-foreground scale-110 group-hover:rotate-6 transition-transform">
                    <Mail className="w-12 h-12" />
                  </div>
                  <div className="relative z-10">
                    <h2 className="text-3xl font-black text-muted-foreground uppercase italic tracking-tighter mb-4">Neural Dispatch Active</h2>
                    <p className="max-w-md text-muted-foreground font-bold uppercase tracking-widest italic leading-relaxed">
                      Detailed activation specs have been transmitted to your linked neural coordinate. Hub access remains active for support.
                    </p>
                  </div>
                  <div className="flex gap-4 pt-4 relative z-10">
                    <div className="px-6 py-3 bg-background border border-border rounded-none flex items-center gap-2">
                      <Clock className="w-4 h-4 text-foreground" />
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground italic">Instant Transmission</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Protocol Steps (Infographic Styling) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
              {[
                { label: 'Check Intel', icon: <Mail className="w-6 h-6" />, desc: 'Verify your inbox' },
                { label: 'Sync Neural', icon: <QrCode className="w-6 h-6" />, desc: 'Scan visual link' },
                { label: 'Connect Hub', icon: <Globe className="w-6 h-6" />, desc: 'Activate and go' }
              ].map((step, i) => (
                <div key={i} className="bg-muted p-10 rounded-none border border-border group hover:border-foreground transition-all text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-muted blur-[50px] -mr-16 -mt-16 pointer-events-none" />
                  <div className="w-14 h-14 rounded-none bg-background border border-border flex items-center justify-center text-muted-foreground mb-8 group-hover:bg-muted group-hover:text-foreground transition-all group-hover:rotate-6">
                    {step.icon}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-3 bg-border group-hover:bg-muted rounded-none transition-colors" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">Protocol {i + 1}</span>
                  </div>
                  <h4 className="text-xl font-black text-muted-foreground uppercase italic tracking-tight mb-2">{step.label}</h4>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest italic">{step.desc}</p>
                </div>
              ))}
            </div>

            {/* Hub Actions */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
              <Button
                onClick={() => router.push(`/${locale}/orders${orderId ? `/${orderId}` : ''}`)}
                size="lg"
                className="w-full sm:w-auto h-20 px-12 rounded-none font-black text-lg uppercase italic tracking-widest group overflow-hidden relative"
              >
                <div className="absolute inset-0 bg-muted/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                <span className="flex items-center gap-3 relative z-10">
                  <Receipt className="w-5 h-5" /> View Protocol Detail
                </span>
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/${locale}/products`)}
                size="lg"
                className="w-full sm:w-auto h-20 px-12 rounded-none font-black text-lg uppercase italic tracking-widest border-2 border-border hover:border-foreground bg-muted group"
              >
                <span className="flex items-center gap-3">
                  <ShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform" /> Acquire Assets
                </span>
              </Button>
            </div>

            {/* System Status */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-none bg-muted animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground italic">Core Systems Stable</span>
              </div>
              <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest italic">
                AUTO-NAV TO HUB SUSPENDED FOR ASSET RETRIEVAL • {countdown}S REMAINING IN PROTOCOL SESSION
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

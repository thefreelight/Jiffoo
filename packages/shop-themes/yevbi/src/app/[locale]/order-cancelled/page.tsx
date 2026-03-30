'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  XCircle,
  RefreshCw,
  ShoppingBag,
  Info,
  AlertTriangle,
  CreditCard,
  Clock,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  MessageSquare
} from 'lucide-react';
import { Button } from '../../../ui/Button';
import { cn } from '../../../lib/utils';

export default function OrderCancelledPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'en';
  const orderId = searchParams.get('orderId');
  const reason = searchParams.get('reason');

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-300">
      <section className="flex-1 flex items-center justify-center py-20 lg:py-32 relative overflow-hidden">
        {/* Background Decorative */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-muted blur-[120px] rounded-none pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Mission Terminated Icon */}
            <div className="mb-12 relative inline-block group">
              <div className="absolute inset-0 bg-muted blur-2xl group-hover: transition-opacity animate-pulse" />
              <div className="relative w-32 h-32 rounded-none bg-muted flex items-center justify-center text-foreground rotate-3 group-hover:rotate-0 transition-transform duration-500 border border-border">
                <ShieldAlert className="w-16 h-16 text-muted-foreground" />
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-muted-foreground uppercase italic tracking-tighter mb-6 leading-none">Transmission Failure</h1>
            <p className="text-xl text-muted-foreground font-medium italic mb-2">The authorization protocol was terminated before completion.</p>
            {orderId && (
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-16 italic">ABORT_REF: {orderId.toUpperCase()}</p>
            )}

            {/* Error Payload */}
            {reason && (
              <div className="bg-muted rounded-none border-2 border-border p-8 mb-16 inline-flex flex-col items-center max-w-xl mx-auto shadow-none">
                <div className="flex items-center gap-3 mb-3 text-muted-foreground">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">Error Payload</span>
                </div>
                <p className="text-sm text-muted-foreground font-black uppercase italic tracking-tight">{decodeURIComponent(reason)}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-20 text-left">
              {/* Restoration Protocol */}
              <div className="bg-muted rounded-none border border-border p-10 lg:p-14">
                <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.3em] italic mb-10">Restoration Protocol</h3>
                <div className="space-y-8">
                  <RestorationLine
                    icon={<CreditCard className="w-5 h-5" />}
                    title="Refund Logic"
                    desc="Any temporary holds will be released within 5-10 business cycles."
                  />
                  <RestorationLine
                    icon={<RefreshCw className="w-5 h-5" />}
                    title="Registry Preservation"
                    desc="Your selected assets remain localized in your dock for re-transmission."
                  />
                  <RestorationLine
                    icon={<Clock className="w-5 h-5" />}
                    title="Critical Window"
                    desc="Session keys expire in 24 hours. Re-initialize at your earliest window."
                  />
                </div>
              </div>

              {/* Status Audit */}
              <div className="bg-muted text-foreground rounded-none p-10 lg:p-14 shadow-none relative overflow-hidden group/audit border border-border">
                <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12 group-hover/audit:rotate-0 transition-transform duration-700">
                  <Info className="w-32 h-32" />
                </div>
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] italic mb-10 relative z-10">Common Failure Points</h3>
                <div className="space-y-8 relative z-10">
                  <AuditLine title="Authentication Block" desc="Mismatch in security tokens or banking protocols." />
                  <AuditLine title="Session Timeout" desc="The secure channel exceeded the allowed duration." />
                  <AuditLine title="Manual Overrule" desc="Transmission was voluntarily aborted by the operator." />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
              <Button
                onClick={() => router.push(`/${locale}/checkout`)}
                size="lg"
                className="w-full sm:w-auto h-20 px-12 rounded-none font-black text-lg uppercase italic tracking-widest"
              >
                <RefreshCw className="w-5 h-5 mr-3" /> Re-trigger Authorization
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push(`/${locale}/products`)}
                size="lg"
                className="w-full sm:w-auto h-20 px-12 rounded-none font-black text-lg uppercase italic tracking-widest border-2 border-border hover:border-foreground hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              >
                <ShoppingBag className="w-5 h-5 mr-3" /> Acquire Assets
              </Button>
            </div>

            {/* Support Signal */}
            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] italic group">
              Still Facing Blockage?{' '}
              <button
                onClick={() => router.push(`/${locale}/contact`)}
                className="text-foreground hover:text-foreground underline underline-offset-8 ml-2 transition-colors"
              >
                Dispatch Signal to Lab
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function RestorationLine({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="flex items-start gap-6 group">
      <div className="w-14 h-14 rounded-none bg-background flex items-center justify-center text-muted-foreground group-hover:bg-muted group-hover:text-foreground transition-all border border-border">
        {icon}
      </div>
      <div>
        <h4 className="text-lg font-black text-muted-foreground uppercase italic tracking-tight mb-1">{title}</h4>
        <p className="text-xs text-muted-foreground font-medium italic leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function AuditLine({ title, desc }: { title: string, desc: string }) {
  return (
    <div>
      <h4 className="text-foreground font-black uppercase italic tracking-widest text-xs mb-2">{title}</h4>
      <p className="text-muted-foreground font-medium italic text-[10px] leading-relaxed uppercase tracking-widest">{desc}</p>
    </div>
  );
}

'use client';

import React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Store,
  Search,
  HelpCircle,
  Globe,
  ShieldAlert,
  ArrowLeft,
  ArrowRight,
  Wifi,
  Zap,
  Cpu,
  ShieldCheck,
  Database
} from 'lucide-react';
import { Button } from '../../../ui/Button';
import { cn } from '../../../lib/utils';

export default function StoreNotFoundPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = (params?.locale as string) || 'en';
  const storeId = searchParams.get('storeId');

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-300">
      <section className="flex-1 flex items-center justify-center py-20 lg:py-32 relative overflow-hidden">
        {/* Background Decorative */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-muted blur-[120px] rounded-none pointer-events-none opacity-50" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Visual Indicator */}
            <div className="mb-12 relative group">
              <div className="w-24 h-24 bg-muted rounded-none flex items-center justify-center mx-auto border border-border group-hover:rotate-12 transition-transform duration-500">
                <Database className="w-12 h-12 text-foreground" />
              </div>
              <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground italic animate-pulse">Node Inaccessible</span>
              </div>
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-muted-foreground uppercase italic tracking-tighter mb-6 leading-none">Transmission Interrupted</h1>
            <p className="text-xl text-muted-foreground font-medium italic mb-2">The requested store instance could not be located in our current registry.</p>
            {storeId && (
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-16 italic">LOG_REF: {storeId.toUpperCase()}</p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mb-20 text-left">
              {/* Possible Status Codes */}
              <div className="lg:col-span-7 bg-muted rounded-none border border-border p-10 lg:p-14 space-y-10">
                <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.3em] italic mb-4">Diagnostics Protocol</h3>
                <div className="space-y-8">
                  <ReasonBox
                    icon={<Zap className="w-5 h-5" />}
                    title="Circuit Fragmented"
                    desc="The requested neural link is invalid or has expired from the cache."
                  />
                  <ReasonBox
                    icon={<Cpu className="w-5 h-5" />}
                    title="Maintenance Cycle"
                    desc="The node is currently undergoing a scheduled architectural upgrade."
                  />
                  <ReasonBox
                    icon={<Globe className="w-5 h-5" />}
                    title="Regional Restriction"
                    desc="Transmission is restricted in your current geographic sector."
                  />
                </div>
              </div>

              {/* Action Sidebar */}
              <div className="lg:col-span-5 space-y-8">
                <div className="bg-muted text-foreground rounded-none p-10 relative overflow-hidden group/card border border-border">
                  <div className="absolute top-0 right-0 p-8 opacity-5 rotate-12 group-hover/card:rotate-0 transition-transform duration-700">
                    <Wifi className="w-32 h-32" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-background rounded-none flex items-center justify-center text-foreground border border-border">
                        <Globe className="w-5 h-5" />
                      </div>
                      <h2 className="text-lg font-black uppercase italic tracking-widest text-foreground">YEVBI Hub</h2>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium italic leading-relaxed mb-10 uppercase tracking-widest">
                      Ready to establish a new global link? Explore eSIM solutions for 190+ sectors.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <StatusLine icon={<Zap />} label="Insta-Sync" />
                      <StatusLine icon={<Globe />} label="190+ Nodes" />
                      <StatusLine icon={<Wifi />} label="24/7 Relay" />
                      <StatusLine icon={<ShieldCheck />} label="Secured" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <Button
                    onClick={() => router.push(`/${locale}`)}
                    className="h-20 rounded-none font-black uppercase italic tracking-widest text-sm"
                  >
                    <ArrowLeft className="w-5 h-5 mr-3" /> Re-enter Hub
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => router.push(`/${locale}/products`)}
                    className="h-20 rounded-none font-black uppercase italic tracking-widest text-sm border-2 border-border hover:border-foreground hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                  >
                    Browse Packages <ArrowRight className="w-5 h-5 ml-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Signal Support */}
            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] italic">
              System Discrepancy?{' '}
              <button
                onClick={() => router.push(`/${locale}/contact`)}
                className="text-foreground hover:text-foreground underline underline-offset-8 ml-2"
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

function ReasonBox({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
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

function StatusLine({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded bg-foreground/10 flex items-center justify-center text-foreground">
        {React.cloneElement(icon as any, { className: 'w-2.5 h-2.5' })}
      </div>
      <span className="text-[8px] font-black text-foreground/50 uppercase tracking-widest italic">{label}</span>
    </div>
  );
}

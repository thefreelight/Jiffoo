'use client';

import { useParams, useRouter } from 'next/navigation';
import { FileText, Gavel, ShieldCheck, Scale, AlertCircle, Cpu, Zap, Globe } from 'lucide-react';
import { cn } from '../../../lib/utils';

export default function TermsPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  return (
    <div className="min-h-screen bg-background pb-40 transition-colors duration-300">
      {/* Content Section */}
      <section className="py-12 px-4 lg:px-8">
        <div className="container mx-auto max-w-5xl">
          <div className="bg-muted rounded-none border border-border p-12 md:p-20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none group-hover:rotate-12 transition-transform duration-1000">
              <Scale className="w-64 h-64" />
            </div>

            <div className="flex items-center gap-6 mb-16 relative z-10">
              <div className="w-2 h-12 bg-muted rounded-none" />
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.4em] text-foreground italic mb-2">Legal Framework</span>
                <h1 className="text-5xl font-black text-muted-foreground uppercase tracking-tighter italic leading-none">Service Protocols</h1>
              </div>
            </div>

            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] italic mb-12 border-b border-border pb-8 flex items-center gap-3">
              <Gavel className="w-4 h-4 text-foreground" />
              Active Protocol Version: 2024.1.0
            </p>

            <div className="space-y-16 relative z-10">
              <section>
                <h2 className="text-2xl font-black text-muted-foreground uppercase italic tracking-tight mb-6 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-none bg-background flex items-center justify-center text-foreground border border-border"><Cpu className="w-4 h-4" /></div>
                  01. Protocol Acceptance
                </h2>
                <div className="text-muted-foreground font-bold uppercase tracking-widest italic text-[11px] leading-[2] pl-12">
                  <p>
                    BY ACCESSING THE YEVBI DATA NETWORK OR UTILIZING OUR DIGITAL ASSETS, YOU AGREE TO BE BOUND BY THESE OPERATIONAL PROTOCOLS. IF YOU DO NOT CONSENT TO THESE TERMS, TERMINATE ALL SYSTEM CONNECTIONS IMMEDIATELY.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-black text-muted-foreground uppercase italic tracking-tight mb-6 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-none bg-background flex items-center justify-center text-foreground border border-border"><Zap className="w-4 h-4" /></div>
                  02. Digital eSIM Assets
                </h2>
                <div className="text-muted-foreground font-bold uppercase tracking-widest italic text-[11px] leading-[2] pl-12 space-y-4">
                  <p>YEVBI PROVIDES HIGH-PERFORMANCE DIGITAL ASSETS SUBJECT TO THE FOLLOWING PARAMETERS:</p>
                  <ul className="list-none space-y-3">
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> ASSETS ARE DELIVERED VIA INSTANT SECURE DISPATCH</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> VALIDITY PERIOD INITIATES UPON FIRST NETWORK SYNC</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> COVERAGE VARIES BASED ON LOCAL CARRIER GRID STATUS</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> OPERATIVE IS RESPONSIBLE FOR HARDWARE COMPATIBILITY</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-black text-muted-foreground uppercase italic tracking-tight mb-6 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-none bg-background flex items-center justify-center text-foreground border border-border"><Scale className="w-4 h-4" /></div>
                  03. Mission Abort & Refunds
                </h2>
                <div className="text-muted-foreground font-bold uppercase tracking-widest italic text-[11px] leading-[2] pl-12 space-y-4">
                  <p>REFUND PROTOCOLS ARE EXECUTED UNDER RIGID CONDITIONS:</p>
                  <ul className="list-none space-y-3">
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> 100% REFUND ELIGIBILITY FOR UN-INITIALIZED ASSETS (7-DAY WINDOW)</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> ZERO REFUND CAPACITY POST-NETWORK ACTIVATION</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> ALL REQUESTS MUST BE COPIED TO SUPPORT COMM-LINK</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> PROCESSING CYCLE: 5-10 TRANSIT DAYS</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-black text-muted-foreground uppercase italic tracking-tight mb-6 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-none bg-background flex items-center justify-center text-foreground border border-border"><AlertCircle className="w-4 h-4" /></div>
                  04. Acceptable Usage
                </h2>
                <div className="text-muted-foreground font-bold uppercase tracking-widest italic text-[11px] leading-[2] pl-12 space-y-3">
                  <p>ILLEGITIMATE USE OF YEVBI ASSETS WILL RESULT IN IMMEDIATE DE-ACTIVATION:</p>
                  <ul className="list-none space-y-3">
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> ENGAGEMENT IN COVERT OR OVERT ILLEGAL OPS</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> DATA OVERLOAD AFFECTING GRID STABILITY</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> UNAUTHORIZED ASSET REDISTRIBUTION</li>
                  </ul>
                </div>
              </section>

              <div className="pt-16 border-t border-border flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="flex items-center gap-4 text-foreground">
                  <ShieldCheck className="w-8 h-8" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">Verified Legal Protocol</span>
                </div>
                <button
                  onClick={() => router.push(`/${locale}/contact`)}
                  className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] italic hover:text-foreground transition-colors border-b-2 border-border pb-1"
                >
                  Contact Legal Counsel
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

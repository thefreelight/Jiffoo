'use client';

import { useParams, useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Eye, FileText, Fingerprint, Globe, Cpu } from 'lucide-react';
import { cn } from '../../../lib/utils';

export default function PrivacyPage() {
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
              <ShieldCheck className="w-64 h-64" />
            </div>

            <div className="flex items-center gap-6 mb-16 relative z-10">
              <div className="w-2 h-12 bg-muted rounded-none" />
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.4em] text-foreground italic mb-2">Secure Archives</span>
                <h1 className="text-5xl font-black text-muted-foreground uppercase tracking-tighter italic leading-none">Privacy Protocol</h1>
              </div>
            </div>

            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] italic mb-12 border-b border-border pb-8 flex items-center gap-3">
              <Fingerprint className="w-4 h-4 text-foreground" />
              Last Encrypted Update: January 1, 2024
            </p>

            <div className="space-y-16 relative z-10">
              <section>
                <h2 className="text-2xl font-black text-muted-foreground uppercase italic tracking-tight mb-6 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-none bg-background flex items-center justify-center text-foreground border border-border"><Cpu className="w-4 h-4" /></div>
                  01. Neural Data Collection
                </h2>
                <div className="text-muted-foreground font-bold uppercase tracking-widest italic text-[11px] leading-[2] pl-12 space-y-4">
                  <p>
                    WE COLLECT ESSENTIAL OPERATIONAL DATA TO INITIATE SECURE GLOBAL SYNC. THIS INCLUDES INFORMATION PROVIDED DIRECTLY DURING ACCOUNT CREATION, ASSET PURCHASE, OR COMM-LINK ENGAGEMENT.
                  </p>
                  <ul className="list-none space-y-3">
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> OPERATIVE IDENTIFICATION & NEURAL ADDRESS</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> AUTH TOKEN (PAYMENT) TRANSACTION REGISTRY</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> HARDWARE SPECS & DEVICE CLONE LOGS</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> MISSION COORDINATES & TEMPORAL DATA</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-black text-muted-foreground uppercase italic tracking-tight mb-6 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-none bg-background flex items-center justify-center text-foreground border border-border"><Globe className="w-4 h-4" /></div>
                  02. Operational Utilization
                </h2>
                <div className="text-muted-foreground font-bold uppercase tracking-widest italic text-[11px] leading-[2] pl-12 space-y-4">
                  <p>RETAINED DATA IS UTILIZED STRICTLY FOR MISSION-CRITICAL OPERATIONS:</p>
                  <ul className="list-none space-y-3">
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> PROCESSING & DISPATCHING DIGITAL eSIM ASSETS</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> MAINTAINING 24/7 ENCRYPTED COMM-LINK SUPPORT</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> EXECUTING CRITICAL PROTOCOL UPDATES</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> LEGAL COMPLIANCE & FRAUD DEFENSE INITIATIVES</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-black text-muted-foreground uppercase italic tracking-tight mb-6 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-none bg-background flex items-center justify-center text-foreground border border-border"><Lock className="w-4 h-4" /></div>
                  03. Asset Encryption & Security
                </h2>
                <div className="text-muted-foreground font-bold uppercase tracking-widest italic text-[11px] leading-[2] pl-12">
                  <p>
                    ALL DATA TRANSMISSIONS ARE PROTECTED BY 256-BIT NEURAL ENCRYPTION. WE IMPLEMENT HIGH-LEVEL DEFENSE PROTOCOLS TO PREVENT UNAUTHORIZED SYSTEM ACCESS, ALTERATION, OR DISCLOSURE OF OPERATIVE RECORDS.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-black text-muted-foreground uppercase italic tracking-tight mb-6 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-none bg-background flex items-center justify-center text-foreground border border-border"><Eye className="w-4 h-4" /></div>
                  04. Operative Rights
                </h2>
                <div className="text-muted-foreground font-bold uppercase tracking-widest italic text-[11px] leading-[2] pl-12 space-y-3">
                  <p>OPERATIVES RETAIN FULL CONTROL OVER THEIR DIGITAL FOOTPRINT:</p>
                  <ul className="list-none space-y-3">
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> REQUEST DATA REGISTRY EXTRACTION</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> INITIATE DATA PURGE PROTOCOLS</li>
                    <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-none bg-muted" /> RECTIFY INACCURATE RECORDS</li>
                  </ul>
                </div>
              </section>

              <div className="pt-16 border-t border-border flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="flex items-center gap-4 text-foreground">
                  <ShieldCheck className="w-8 h-8" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">Encrypted Secure Node</span>
                </div>
                <button
                  onClick={() => router.push(`/${locale}/contact`)}
                  className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] italic hover:text-foreground transition-colors border-b-2 border-border pb-1"
                >
                  Contact Security Officer
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

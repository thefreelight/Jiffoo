'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Mail,
  MessageCircle,
  Clock,
  ArrowRight,
  CheckCircle2,
  Send,
  HelpCircle,
  Headphones,
  MapPin,
  Globe,
  Radio,
  Zap,
  ShieldCheck,
  Cpu,
  Fingerprint,
  ChevronDown
} from 'lucide-react';
import { Button } from '../../../ui/Button';
import { cn } from '../../../lib/utils';

export default function ContactPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate mission transmission
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setSubmitted(true);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background pb-40 transition-colors duration-300">
      {/* Performance Hero */}
      <section className="bg-muted py-32 text-foreground relative overflow-hidden mx-4 lg:mx-8 rounded-none border border-border">
        <div className="absolute inset-0 bg-background blur-[120px] rounded-none scale-110 pointer-events-none opacity-50" />
        <div className="absolute top-0 right-0 p-20 opacity-[0.03] pointer-events-none animate-pulse">
          <Radio className="w-96 h-96" />
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="w-20 h-20 bg-background backdrop-blur-3xl rounded-none flex items-center justify-center mx-auto mb-10 border border-border">
            <Headphones className="w-10 h-10 text-foreground" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-8 italic tracking-tighter uppercase leading-none">Signal Dispatch</h1>
          <p className="text-muted-foreground font-bold max-w-2xl mx-auto text-xl italic tracking-widest leading-relaxed uppercase">
            Global support relay active 24/7/365. Initiate encrypted transmission for immediate assistance.
          </p>
        </div>
      </section>

      {/* Mission Interface Section */}
      <section className="py-24 -mt-20 relative z-20 px-4 lg:px-8">
        <div className="container mx-auto">
          <div className="flex flex-col lg:flex-row gap-16 items-start max-w-7xl mx-auto">

            {/* Neural Relay Form */}
            <div className="lg:w-2/3 w-full">
              <div className="bg-muted rounded-none border border-border p-12 md:p-20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none group-hover:rotate-12 transition-transform duration-1000">
                  <Fingerprint className="w-64 h-64" />
                </div>

                <div className="flex items-center gap-6 mb-16 relative z-10">
                  <div className="w-2 h-12 bg-muted rounded-none" />
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-[0.4em] text-foreground italic mb-2">Transmission Link</span>
                    <h2 className="text-4xl font-black text-muted-foreground uppercase tracking-tighter italic leading-none">Encrypted Message</h2>
                  </div>
                </div>

                {submitted ? (
                  <div className="text-center py-20 animate-in fade-in zoom-in duration-700 relative z-10">
                    <div className="w-32 h-32 bg-background rounded-none flex items-center justify-center mx-auto mb-10 text-muted-foreground border border-border">
                      <CheckCircle2 className="w-16 h-16" />
                    </div>
                    <h3 className="text-4xl font-black text-muted-foreground mb-6 uppercase italic tracking-tighter">Signal Synchronized</h3>
                    <p className="text-muted-foreground font-bold uppercase tracking-widest italic text-[11px] leading-relaxed max-w-md mx-auto mb-16 px-4">
                      Transmission logged. Field operatives will review and respond within a 120-minute window.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setSubmitted(false)}
                      className="rounded-none h-20 px-12 font-black border-2 border-border hover:border-foreground transition-all uppercase italic tracking-widest text-sm"
                    >
                      New Transmission
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-12 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-4">
                        <label htmlFor="name" className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground ml-6 italic">
                          Operative Name
                        </label>
                        <input
                          id="name"
                          type="text"
                          placeholder="IDENTIFY YOURSELF"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full h-20 px-8 bg-background border border-border rounded-none focus:outline-none focus:ring-2 focus:ring-foreground focus:bg-muted transition-all font-black uppercase italic tracking-widest placeholder:text-muted-foreground/50"
                          required
                        />
                      </div>
                      <div className="space-y-4">
                        <label htmlFor="email" className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground ml-6 italic">
                          Neural Address
                        </label>
                        <input
                          id="email"
                          type="email"
                          placeholder="SYNC@NETWORK.COM"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full h-20 px-8 bg-background border border-border rounded-none focus:outline-none focus:ring-2 focus:ring-foreground focus:bg-muted transition-all font-black uppercase italic tracking-widest placeholder:text-muted-foreground/50"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label htmlFor="subject" className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground ml-6 italic">
                        Mission Protocol
                      </label>
                      <div className="relative">
                        <select
                          id="subject"
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          className="w-full h-20 px-8 bg-background border border-border rounded-none focus:outline-none focus:ring-2 focus:ring-foreground focus:bg-muted transition-all font-black uppercase italic tracking-widest appearance-none cursor-pointer"
                          required
                        >
                          <option value="">SELECT PROTOCOL</option>
                          <option value="order">DEPLOYMENT & SYNC ISSUES</option>
                          <option value="installation">HARDWARE INTEGRATION HELP</option>
                          <option value="billing">AUTH TOKEN & BILLING</option>
                          <option value="refund">MISSION ABORT REQUEST</option>
                          <option value="other">GENERAL INTEL</option>
                        </select>
                        <ChevronDown className="absolute right-8 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label htmlFor="message" className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground ml-6 italic">
                        Intel Details
                      </label>
                      <textarea
                        id="message"
                        rows={8}
                        placeholder="SPECIFY OPERATIONAL REQUIREMENTS..."
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full px-8 py-8 bg-background border border-border rounded-none focus:outline-none focus:ring-2 focus:ring-foreground focus:bg-muted transition-all font-black uppercase italic tracking-widest placeholder:text-muted-foreground/50 resize-none"
                        required
                      ></textarea>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-24 rounded-none font-black text-2xl uppercase italic tracking-widest active:scale-[0.98] transition-transform relative overflow-hidden group/btn"
                    >
                      <div className="absolute inset-0 bg-background/20 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                      {isSubmitting ? (
                        <span className="relative z-10 flex items-center gap-4">SYNCING SIGNAL <Cpu className="w-7 h-7 animate-spin" /></span>
                      ) : (
                        <span className="relative z-10 flex items-center gap-4">DISPATCH SIGNAL <Send className="w-7 h-7" /></span>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </div>

            {/* Comm-Link Sidebar */}
            <div className="lg:w-1/3 w-full flex flex-col gap-10 lg:sticky lg:top-32">
              <div className="bg-muted rounded-none border border-border p-12 overflow-hidden relative group/sidebar">
                <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none group-hover/sidebar:rotate-12 transition-transform duration-1000">
                  <Globe className="w-64 h-64" />
                </div>

                <div className="flex items-center gap-4 mb-12">
                  <div className="w-12 h-12 rounded-none bg-background flex items-center justify-center text-foreground border border-border">
                    <Radio className="w-6 h-6" />
                  </div>
                  <h2 className="text-xs font-black text-foreground uppercase tracking-[0.4em] italic mb-0">Command Hub</h2>
                </div>

                <div className="space-y-12">
                  <div className="flex items-start group/item">
                    <div className="h-14 w-14 bg-background rounded-none flex items-center justify-center mr-6 flex-shrink-0 text-muted-foreground transition-colors group-hover/item:bg-muted group-hover/item:text-foreground border border-border">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-2 italic">Neural Address</h3>
                      <p className="text-foreground font-black uppercase italic tracking-widest text-sm">support@yevbi.com</p>
                    </div>
                  </div>

                  <div className="flex items-start group/item">
                    <div className="h-14 w-14 bg-background rounded-none flex items-center justify-center mr-6 flex-shrink-0 text-muted-foreground transition-colors group-hover/item:bg-muted group-hover/item:text-foreground border border-border">
                      <MessageCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-2 italic">Priority Link</h3>
                      <p className="text-foreground font-black uppercase italic tracking-widest text-sm">LIVE CHAT ACTIVE 24/7</p>
                    </div>
                  </div>

                  <div className="flex items-start group/item">
                    <div className="h-14 w-14 bg-background rounded-none flex items-center justify-center mr-6 flex-shrink-0 text-muted-foreground transition-colors group-hover/item:bg-muted group-hover/item:text-foreground border border-border">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-2 italic">Sync Window</h3>
                      <p className="text-foreground font-black uppercase italic tracking-widest text-sm">&lt; 120 MINUTE TARGET</p>
                    </div>
                  </div>
                </div>

                <div className="mt-16 pt-12 border-t border-border">
                  <div className="flex items-center justify-between bg-background px-6 py-4 rounded-none border border-border">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground italic">Security Status</span>
                    <div className="flex gap-2">
                      {[1, 2, 3].map(i => <div key={i} className="w-2.5 h-2.5 rounded-none bg-muted shadow-none animate-pulse" />)}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="bg-muted rounded-none p-12 relative overflow-hidden group/cta cursor-pointer hover:bg-muted transition-all border border-border"
                onClick={() => router.push(`/${locale}/help`)}
              >
                <div className="absolute top-0 right-0 p-12 pointer-events-none group-hover/cta:scale-110 transition-transform">
                  <Zap className="w-32 h-32 text-foreground opacity-10" />
                </div>
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <div className="w-16 h-16 bg-background rounded-none flex items-center justify-center text-foreground group-hover/cta:scale-110 transition-transform border border-border">
                    <HelpCircle className="w-8 h-8" />
                  </div>
                  <ArrowRight className="w-6 h-6 text-foreground group-hover/cta:translate-x-2 transition-transform" />
                </div>
                <h3 className="text-3xl font-black text-foreground uppercase tracking-tighter italic leading-none mb-4 relative z-10">Instant Intel</h3>
                <p className="text-foreground font-bold uppercase tracking-widest italic text-[11px] leading-relaxed relative z-10 opacity-70 group-hover:opacity-100 transition-opacity">
                  Access the neural database for immediate activation specs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ChevronRightSmall({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
    </svg>
  );
}

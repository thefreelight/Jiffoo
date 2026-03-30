'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Zap, QrCode, Wifi, MapPin, CheckCircle, ArrowRight, ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';

const steps = [
  {
    number: '01',
    icon: <MapPin className="w-6 h-6" />,
    title: 'Choose Your Plan',
    description:
      'Browse plans by region or destination. Pick the data amount and validity period that fits your trip — from 1GB weekend plans to unlimited monthly coverage.',
    detail: 'Available in 150+ countries and regions.',
  },
  {
    number: '02',
    icon: <CheckCircle className="w-6 h-6" />,
    title: 'Secure Checkout',
    description:
      'Pay securely with your credit card, Apple Pay, or Google Pay. Your order is confirmed instantly with a receipt sent to your email.',
    detail: 'SSL encrypted · No hidden fees.',
  },
  {
    number: '03',
    icon: <QrCode className="w-6 h-6" />,
    title: 'Install Your eSIM',
    description:
      "You'll receive a QR code by email and in your account. Scan it from your device's Settings → Cellular → Add eSIM. Takes less than 2 minutes.",
    detail: 'Compatible with iPhone XR+, Samsung S20+, Pixel 3+, and more.',
  },
  {
    number: '04',
    icon: <Wifi className="w-6 h-6" />,
    title: 'Connect Anywhere',
    description:
      'Switch to your YEVBI eSIM when you land. Your plan activates the moment you first connect — no SIM swap, no roaming fees.',
    detail: '4G / 5G networks · Instant activation on arrival.',
  },
];

const faqs = [
  {
    q: 'What devices support eSIM?',
    a: 'Most modern smartphones released after 2018 support eSIM — including iPhone XR and later, Samsung Galaxy S20+, Google Pixel 3+, and many others. Check Settings → Cellular for an "Add eSIM" option to confirm.',
  },
  {
    q: 'When does my plan start?',
    a: 'Your plan starts when you first connect to a local network at your destination. Installing the eSIM beforehand does not start the countdown.',
  },
  {
    q: 'Can I keep my regular number?',
    a: 'Yes. Your YEVBI eSIM is a second line — your existing SIM stays active. You can receive calls and texts on your home number while using YEVBI data.',
  },
  {
    q: 'What if I run out of data?',
    a: 'You can purchase a top-up anytime from your account dashboard. Your connection continues without interruption.',
  },
];

export default function HowItWorksPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">

      {/* Hero */}
      <section className="pt-32 pb-20 border-b border-border">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-8 border border-border">
            <span className="w-1.5 h-1.5 bg-foreground block" />
            Setup Guide
          </div>
          <h1 className="text-4xl lg:text-6xl font-bold uppercase tracking-tight mb-6 leading-none">
            How It Works
          </h1>
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest max-w-xl leading-relaxed">
            Get connected in four simple steps. No physical SIM card required.
          </p>
        </div>
      </section>

      {/* Steps — grid layout */}
      <section className="py-24">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border">
            {steps.map((step) => (
              <div
                key={step.number}
                className="bg-background p-10 group hover:bg-muted transition-colors duration-200"
              >
                <div className="flex items-start gap-5 mb-6">
                  <span className="font-mono font-bold text-xs text-muted-foreground/50 flex-shrink-0 mt-0.5">{step.number}</span>
                  <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {step.icon}
                  </div>
                </div>
                <h2 className="text-lg font-bold uppercase tracking-tight mb-3 leading-snug">
                  {step.title}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4 max-w-sm">
                  {step.description}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <h2 className="text-2xl font-bold uppercase tracking-tight mb-14 font-mono">
            Common Questions
          </h2>
          <div className="flex flex-col divide-y divide-border">
            {faqs.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={item.q}>
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full py-6 text-left flex items-center justify-between group"
                  >
                    <h3 className={cn(
                      'font-bold text-sm uppercase tracking-tight transition-colors',
                      isOpen ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                    )}>
                      {item.q}
                    </h3>
                    <ChevronDown className={cn(
                      'w-4 h-4 flex-shrink-0 ml-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-all duration-200',
                      isOpen && 'rotate-180 text-foreground'
                    )} />
                  </button>
                  {isOpen && (
                    <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl pb-6">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl text-center">
          <h2 className="text-3xl lg:text-5xl font-bold uppercase tracking-tight mb-6 leading-none">
            Ready to Stay Connected?
          </h2>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest mb-10">
            Browse plans starting from $4.99 · No contract · Cancel anytime
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push(`/${locale}/products`)}
              className="font-mono text-sm uppercase tracking-widest px-8 py-4 bg-foreground text-background border border-foreground hover:bg-transparent hover:text-foreground transition-all flex items-center justify-center gap-2"
            >
              Get eSIM <Zap className="w-4 h-4 fill-current" />
            </button>
            <button
              onClick={() => router.push(`/${locale}/help`)}
              className="font-mono text-sm uppercase tracking-widest px-8 py-4 border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-all flex items-center justify-center gap-2"
            >
              Visit Help Center <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

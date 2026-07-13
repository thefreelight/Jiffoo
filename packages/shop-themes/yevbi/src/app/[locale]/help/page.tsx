'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Search,
  BookOpen,
  Video,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Mail,
  Globe,
  CreditCard,
  ShieldCheck,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

const faqs = [
  {
    category: 'Getting Started',
    icon: <Zap className="w-4 h-4" />,
    questions: [
      {
        q: 'What is a YEVBI eSIM?',
        a: 'A YEVBI eSIM is a digital SIM card built into your phone. It lets you connect to local networks abroad without swapping a physical SIM card — just scan a QR code and you\'re online.',
      },
      {
        q: 'Does my device support eSIM?',
        a: 'Most smartphones released after 2018 support eSIM — including iPhone XR and later, Samsung Galaxy S20+, and Google Pixel 3+. To check, go to Settings → Cellular → "Add eSIM". If the option appears, you\'re compatible.',
      },
      {
        q: 'How do I install my eSIM?',
        a: 'After purchase, you\'ll receive a QR code by email and in your account. Open Settings → Cellular → Add eSIM, then scan the QR code. The whole process takes under 2 minutes.',
      },
    ],
  },
  {
    category: 'Orders & Payment',
    icon: <CreditCard className="w-4 h-4" />,
    questions: [
      {
        q: 'When will I receive my eSIM?',
        a: 'Your QR code is delivered instantly after payment — check your email inbox and your account page. No waiting, no shipping.',
      },
      {
        q: 'What payment methods are accepted?',
        a: 'We accept all major credit and debit cards (Visa, Mastercard, Amex), PayPal, Apple Pay, and Google Pay.',
      },
      {
        q: 'What is your refund policy?',
        a: 'We offer a full refund within 7 days for any eSIM that has not been activated. Once you connect to a network at your destination, the plan is active and non-refundable.',
      },
    ],
  },
  {
    category: 'Using Your Plan',
    icon: <Globe className="w-4 h-4" />,
    questions: [
      {
        q: 'When does my plan validity start?',
        a: 'Your plan\'s validity countdown begins the first time you connect to a local network at your destination. Installing the eSIM beforehand does not start the timer.',
      },
      {
        q: 'What happens when I run out of data?',
        a: 'You can purchase a top-up anytime from your account dashboard. Select your active plan and add more data — your connection continues without interruption.',
      },
      {
        q: 'Can I make calls and send texts?',
        a: 'YEVBI plans are data-only. For calls and texts, use apps like WhatsApp, iMessage, or FaceTime over your YEVBI data connection.',
      },
    ],
  },
];

const categories = [
  {
    icon: <BookOpen className="w-5 h-5" />,
    title: 'Getting Started Guide',
    description: 'Step-by-step setup instructions for new users.',
    cta: 'Read Guide',
  },
  {
    icon: <Video className="w-5 h-5" />,
    title: 'Video Tutorials',
    description: 'Watch installation guides for iOS and Android.',
    cta: 'Watch Now',
  },
  {
    icon: <MessageCircle className="w-5 h-5" />,
    title: 'Live Chat',
    description: 'Chat with our support team — available 24/7.',
    cta: 'Start Chat',
  },
];

export default function HelpPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleQuestion = (id: string) => {
    setOpenQuestion(openQuestion === id ? null : id);
  };

  const filteredFaqs = faqs.map((cat) => ({
    ...cat,
    questions: cat.questions.filter(
      (item) =>
        !searchQuery ||
        item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.a.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((cat) => cat.questions.length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">

      {/* Hero */}
      <section className="pt-32 pb-20 bg-background border-b border-border">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-8 border border-border">
            <span className="w-1.5 h-1.5 bg-foreground block" />
            Support
          </div>
          <h1 className="text-4xl lg:text-6xl font-bold uppercase tracking-tight mb-6 leading-none">Help Center</h1>
          <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest max-w-xl leading-relaxed mb-12">
            Find answers, tutorials, and support for your eSIM.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl relative">
            <div className="bg-muted border border-border flex items-center focus-within:border-foreground/30 transition-colors">
              <div className="pl-5 text-muted-foreground/50">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search for help (e.g. activation, refund, device)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-none focus:ring-0 text-foreground placeholder-muted-foreground/40 font-mono h-12 px-4 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="pr-5 text-muted-foreground/50 hover:text-muted-foreground font-mono text-xs uppercase transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Support Categories */}
      <section className="py-24">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border">
            {categories.map((cat) => (
              <div
                key={cat.title}
                className="bg-background p-8 group hover:bg-muted transition-colors duration-200 cursor-pointer"
              >
                <div className="text-muted-foreground mb-5 group-hover:text-foreground transition-colors">
                  {cat.icon}
                </div>
                <h3 className="text-sm font-bold text-foreground mb-2 uppercase tracking-tight">{cat.title}</h3>
                <p className="text-muted-foreground/50 font-mono text-xs leading-relaxed mb-6">{cat.description}</p>
                <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground uppercase tracking-widest flex items-center gap-1.5 transition-colors">
                  {cat.cta} <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <h2 className="text-2xl font-bold uppercase tracking-tight mb-14 font-mono">
            {searchQuery ? `Results for "${searchQuery}"` : 'Common Questions'}
          </h2>

          {filteredFaqs.length === 0 && (
            <p className="text-muted-foreground/50 font-mono text-sm uppercase tracking-widest py-12">
              No results found. Try a different search term.
            </p>
          )}

          <div className="space-y-16">
            {filteredFaqs.map((category, categoryIndex) => (
              <div key={categoryIndex}>
                <div className="flex items-center gap-3 mb-8">
                  <div className="text-muted-foreground/50">{category.icon}</div>
                  <h3 className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em]">{category.category}</h3>
                </div>

                <div className="flex flex-col divide-y divide-border">
                  {category.questions.map((item, questionIndex) => {
                    const id = `${categoryIndex}-${questionIndex}`;
                    const isOpen = openQuestion === id;
                    return (
                      <div key={id}>
                        <button
                          onClick={() => toggleQuestion(id)}
                          className="w-full py-5 text-left flex items-center justify-between group"
                        >
                          <span className={cn(
                            'text-sm font-bold uppercase tracking-tight transition-colors',
                            isOpen ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                          )}>{item.q}</span>
                          <ChevronDown className={cn(
                            'w-4 h-4 flex-shrink-0 ml-4 text-muted-foreground/50 transition-all duration-200 group-hover:text-muted-foreground',
                            isOpen && 'rotate-180 text-foreground'
                          )} />
                        </button>
                        {isOpen && (
                          <p className="text-muted-foreground font-mono text-xs leading-relaxed max-w-2xl pb-5">
                            {item.a}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl text-center">
          <h2 className="text-3xl lg:text-5xl font-bold uppercase tracking-tight mb-6 leading-none">
            Still Need Help?
          </h2>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest mb-10">
            Our support team is available 24/7 to assist you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push(`/${locale}/contact`)}
              className="font-mono text-sm uppercase tracking-widest px-8 py-4 bg-foreground text-background border border-foreground hover:bg-transparent hover:text-foreground transition-all flex items-center justify-center gap-2"
            >
              Contact Support
            </button>
            <button
              className="font-mono text-sm uppercase tracking-widest px-8 py-4 border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-all flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" /> Email Us
            </button>
          </div>
          <div className="mt-12 flex items-center justify-center gap-8 font-mono text-[10px] text-muted-foreground/50 tracking-widest uppercase">
            <span className="flex items-center gap-2"><Globe className="w-3 h-3" /> Global Support</span>
            <span className="flex items-center gap-2"><ShieldCheck className="w-3 h-3" /> Secure & Private</span>
          </div>
        </div>
      </section>
    </div>
  );
}

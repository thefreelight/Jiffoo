'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Globe,
  Wifi,
  Calendar,
  Search,
  Star,
  Zap,
  ShieldCheck,
  DollarSign,
  Headphones,
  ChevronRight,
  Play,
  ArrowRight,
  ShoppingCart,
  QrCode,
  MapPin,
  CheckCircle2,
  Lock,
  Smartphone,
  Cpu,
  Mail
} from 'lucide-react';
import { productsApi, type Product } from '../../lib/api';
import {
  getFirstImageUrl,
  YEVBI_CTA_VISUAL,
  YEVBI_HERO_VISUAL,
  YEVBI_PRODUCT_FALLBACK_VISUAL,
  YEVBI_TESTIMONIAL_AVATARS,
} from '../../lib/theme-assets';
import { Button } from '../../ui/Button';
import { cn } from '../../lib/utils';

const testimonials = [
  {
    id: '1',
    name: 'Sarah Johnson',
    role: 'Digital Nomad',
    image: YEVBI_TESTIMONIAL_AVATARS.sarah,
    rating: 5,
    text: "Yevbi eSIM worked flawlessly during my trip across Europe. Setup was under 2 minutes and I had 5G speeds in every city. Absolute game changer.",
  },
  {
    id: '2',
    name: 'Michael Chen',
    role: 'Tech Executive',
    image: YEVBI_TESTIMONIAL_AVATARS.michael,
    rating: 5,
    text: "No more hunting for physical SIMs at airports. I activate my plan while taxiing on the runway. The reliability is unmatched compared to others.",
  },
  {
    id: '3',
    name: 'Alicia Rodriguez',
    role: 'Travel Vlogger',
    image: YEVBI_TESTIMONIAL_AVATARS.alicia,
    rating: 5,
    text: "The 24/7 support is incredible. I had a small question at 3 AM in Tokyo and they responded instantly. You're never alone with Yevbi.",
  },
];

export default function Home() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  const [destination, setDestination] = useState('');
  const [dataNeeded, setDataNeeded] = useState('');
  const [duration, setDuration] = useState('');
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        const response = await productsApi.getProducts(1, 4, {}, locale);
        setFeaturedProducts(response.items);
      } catch (error) {
        console.error('Failed to fetch featured products:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFeaturedProducts();
  }, [locale]);

  const handleFindPlans = () => {
    router.push(`/${locale}/products${destination ? `?search=${destination}` : ''}`);
  };

  const handleViewPackage = (id: string) => {
    router.push(`/${locale}/products/${id}`);
  };

  const handleBrowsePackages = () => {
    router.push(`/${locale}/products`);
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden transition-colors duration-300">
      <div className="network-grid-bg"></div>
      {/* Hero Section */}
      <section className="relative h-[85vh] min-h-[700px] flex items-center overflow-hidden bg-muted">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent blur-[150px] rounded-none animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-accent blur-[150px] rounded-none" />
          <img
            src={YEVBI_HERO_VISUAL}
            alt="Travel destinations"
            className="w-full h-full object-cover mix-blend-overlay scale-110 opacity-40"
          />
          <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-background via-background/50 to-transparent" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-none bg-accent/10 backdrop-blur-md border border-border text-foreground text-xs font-black uppercase tracking-[0.3em] mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Zap className="w-3 h-3 fill-muted-foreground" /> Next-Gen Connectivity
            </div>
            <h1 className="text-6xl md:text-8xl font-black text-foreground mb-8 italic leading-[0.9] uppercase tracking-tighter animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
              Stay connected<br />
              <span className="text-foreground underline decoration-foreground/20 underline-offset-8">seamlessly</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-medium mb-12 max-w-2xl leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              Premium eSIM travel packages for 190+ countries. Zero contracts, instant activation, and unlimited global freedom.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
              <Button
                size="lg"
                onClick={handleBrowsePackages}
                className="h-16 px-10 rounded-none font-black text-xl active:scale-95 transition-transform bg-primary text-primary-foreground hover:bg-muted hover:text-foreground"
              >
                Browse Plans <ArrowRight className="w-6 h-6 ml-3" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-16 px-10 rounded-none font-black text-xl active:scale-95 transition-transform bg-transparent border border-border text-foreground hover:bg-muted hover:text-foreground shadow-none"
              >
                <Play className="w-5 h-5 mr-3 fill-foreground" /> How it Works
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Search Hub */}
      <section className="container mx-auto px-4 -mt-24 relative z-30">
        <div className="bg-card rounded-none p-10 md:p-12 border border-border transition-colors">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-4 flex items-center gap-2">
                <Globe className="w-3 h-3" /> Destination
              </label>
              <div className="relative group">
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full h-16 pl-6 pr-12 bg-background text-foreground border border-border rounded-none focus:outline-none focus:ring-2 focus:ring-border focus:bg-background transition-all font-bold appearance-none cursor-pointer shadow-none"
                >
                  <option value="">Global Coverage</option>
                  <option>United States</option>
                  <option>Europe (Regional)</option>
                  <option>Japan</option>
                  <option>Thailand</option>
                  <option>Australia</option>
                </select>
                <ChevronDownSmall className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-4 flex items-center gap-2">
                <Wifi className="w-3 h-3" /> Data Volume
              </label>
              <div className="relative group">
                <select
                  value={dataNeeded}
                  onChange={(e) => setDataNeeded(e.target.value)}
                  className="w-full h-16 pl-6 pr-12 bg-muted text-foreground border border-border rounded-none focus:outline-none focus:ring-2 focus:ring-border focus:bg-muted transition-all font-bold appearance-none cursor-pointer shadow-none"
                >
                  <option value="">Any Data</option>
                  <option>1GB - Starter</option>
                  <option>3GB - Traveler</option>
                  <option>5GB - Regular</option>
                  <option>10GB - Power</option>
                  <option>Unlimited</option>
                </select>
                <ChevronDownSmall className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-4 flex items-center gap-2">
                <Calendar className="w-3 h-3" /> Validity Period
              </label>
              <div className="relative group">
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full h-16 pl-6 pr-12 bg-muted text-foreground border border-border rounded-none focus:outline-none focus:ring-2 focus:ring-border focus:bg-muted transition-all font-bold appearance-none cursor-pointer shadow-none"
                >
                  <option value="">Any Duration</option>
                  <option>7 days</option>
                  <option>14 days</option>
                  <option>30 days</option>
                  <option>90 days</option>
                </select>
                <ChevronDownSmall className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleFindPlans}
                className="w-full h-16 inline-flex items-center justify-center rounded-none font-black text-lg tracking-tight active:scale-95 transition-all bg-background text-foreground border border-border hover:bg-muted hover:border-foreground"
              >
                Find Packages <Search className="w-5 h-5 ml-2" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Destinations */}
      <section className="py-32">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
            <div className="max-w-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-8 bg-accent rounded-none" />
                <h3 className="text-sm font-black text-muted-foreground uppercase tracking-[0.2em] italic">Trending Now</h3>
              </div>
              <h2 className="text-5xl md:text-6xl font-black text-muted-foreground uppercase tracking-tighter italic leading-none">Popular Destinations</h2>
            </div>
            <Button variant="ghost" onClick={handleBrowsePackages} className="font-black text-foreground hover:text-foreground hover:bg-muted h-14 rounded-none px-8 text-lg">
              View All Global Plans <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="aspect-[4/5] bg-muted rounded-none animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {featuredProducts.length > 0 ? (
                featuredProducts.map((product) => (
                  <div key={product.id} className="group cursor-pointer" onClick={() => handleViewPackage(product.id)}>
                    <div className="relative aspect-[4/5] overflow-hidden rounded-none mb-6 group-hover: transition-all duration-500">
                      <img
                        src={getFirstImageUrl(product.images, YEVBI_PRODUCT_FALLBACK_VISUAL)}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent group-hover: transition-opacity" />
                      <div className="absolute top-6 right-6 bg-muted/20 backdrop-blur-xl border border-border rounded-none py-2 px-4">
                        <span className="text-sm font-black text-foreground italic tracking-tight">from ${product.price}</span>
                      </div>
                      <div className="absolute bottom-8 left-8 right-8 text-foreground">
                        <div className="flex items-center gap-1 mb-2">
                          <Star className="w-3 h-3 fill-muted-foreground text-foreground" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-foreground">4.9 Global Rating</span>
                        </div>
                        <h3 className="text-2xl font-black uppercase tracking-tight italic mb-1">{product.name}</h3>
                        <p className="text-foreground/60 text-xs font-bold uppercase tracking-widest truncate">{product.description?.substring(0, 30)}...</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-24 text-center border border-solid border-border bg-card rounded-none">
                  <Globe className="w-16 h-16 text-foreground mx-auto mb-6" />
                  <p className="text-muted-foreground font-bold text-xl uppercase tracking-widest italic">Discovering destinations...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* How It Works - Premium Visuals */}
      <section className="py-32 bg-muted text-foreground relative overflow-hidden transition-colors">
        {/* Subtle Background Art */}
        <div className="absolute top-0 right-0 p-12 pointer-events-none">
          <QrCode className="w-64 h-64" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl mb-24">
            <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter italic mb-8">Connectivity in<br />3 simple steps</h2>
            <p className="text-muted-foreground font-medium text-lg leading-relaxed">No physical stores. No paperwork. Just instant digital freedom across 190+ countries.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-20">
            <div className="relative group">
              <div className="w-16 h-16 bg-muted rounded-none flex items-center justify-center text-foreground border border-border mb-10 -600/10 group-hover:scale-110 transition-transform duration-500">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <h3 className="text-3xl font-black uppercase tracking-tight italic mb-4">1. Select Package</h3>
              <p className="text-muted-foreground font-medium leading-relaxed">Search for your destination and choose the data package that fits your trip length and usage needs.</p>
              <div className="absolute -left-4 top-0 text-[120px] font-black text-foreground/5 pointer-events-none leading-none select-none">01</div>
            </div>

            <div className="relative group">
              <div className="w-16 h-16 bg-muted rounded-none flex items-center justify-center text-foreground border border-border mb-10 -600/10 group-hover:scale-110 transition-transform duration-500">
                <QrCode className="w-8 h-8" />
              </div>
              <h3 className="text-3xl font-black uppercase tracking-tight italic mb-4">2. Instant Scan</h3>
              <p className="text-muted-foreground font-medium leading-relaxed">Receive your personal QR code via email immediately. Scan it into your device settings to install.</p>
              <div className="absolute -left-4 top-0 text-[120px] font-black text-foreground/5 pointer-events-none leading-none select-none">02</div>
            </div>

            <div className="relative group">
              <div className="w-16 h-16 bg-muted rounded-none flex items-center justify-center text-foreground border border-border mb-10 -600/10 group-hover:scale-110 transition-transform duration-500">
                <Wifi className="w-8 h-8" />
              </div>
              <h3 className="text-3xl font-black uppercase tracking-tight italic mb-4">3. Stay Online</h3>
              <p className="text-muted-foreground font-medium leading-relaxed">Activate when you arrive. You're connected to local providers at local rates from the moment you land.</p>
              <div className="absolute -left-4 top-0 text-[120px] font-black text-foreground/5 pointer-events-none leading-none select-none">03</div>
            </div>
          </div>
        </div>
      </section>

      {/* Grid Features */}
      <section className="py-32 bg-background transition-colors">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="p-10 rounded-none bg-background border border-border group hover:bg-muted transition-all duration-500">
              <div className="w-14 h-14 bg-muted rounded-none flex items-center justify-center text-foreground border border-border mb-8 group-hover:text-foreground transition-colors">
                <Zap className="w-7 h-7" />
              </div>
              <h4 className="text-xl font-black uppercase tracking-tight italic mb-4 group-hover:text-foreground transition-colors">Digital First</h4>
              <p className="text-muted-foreground font-medium group-hover:text-foreground/70 transition-colors">Instant delivery. Zero physical waste. Managed entirely from your dashboard.</p>
            </div>

            <div className="p-10 rounded-none bg-background border border-border group hover:bg-muted transition-all duration-500">
              <div className="w-14 h-14 bg-muted rounded-none flex items-center justify-center text-foreground border border-border mb-8 group-hover:text-foreground transition-colors">
                <Lock className="w-7 h-7" />
              </div>
              <h4 className="text-xl font-black uppercase tracking-tight italic mb-4 group-hover:text-foreground transition-colors">Safe Secure</h4>
              <p className="text-muted-foreground font-medium group-hover:text-foreground/70 transition-colors">Banking-grade encryption for every transaction and personal data shield.</p>
            </div>

            <div className="p-10 rounded-none bg-background border border-border group hover:bg-muted transition-all duration-500">
              <div className="w-14 h-14 bg-muted rounded-none flex items-center justify-center text-foreground border border-border mb-8 group-hover:text-foreground transition-colors">
                <Globe className="w-7 h-7" />
              </div>
              <h4 className="text-xl font-black uppercase tracking-tight italic mb-4 group-hover:text-foreground transition-colors">Global Tier-1</h4>
              <p className="text-muted-foreground font-medium group-hover:text-foreground/70 transition-colors">Exclusive partnerships with leading global carriers for guaranteed 5G.</p>
            </div>

            <div className="p-10 rounded-none bg-background border border-border group hover:bg-muted transition-all duration-500">
              <div className="w-14 h-14 bg-muted rounded-none flex items-center justify-center text-foreground border border-border mb-8 group-hover:text-foreground transition-colors">
                <Headphones className="w-7 h-7" />
              </div>
              <h4 className="text-xl font-black uppercase tracking-tight italic mb-4 group-hover:text-foreground transition-colors">24/7 Human</h4>
              <p className="text-muted-foreground font-medium group-hover:text-foreground/70 transition-colors">Real human experts active every second across every time zone.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-32 bg-background border-y border-border transition-colors">
        <div className="container mx-auto px-4">
          <div className="text-center mb-24">
            <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter italic mb-6 leading-none">Global Voices</h2>
            <p className="text-muted-foreground font-bold uppercase tracking-[0.3em] text-xs underline decoration-foreground underline-offset-8">Joined by 100k+ frequent travelers</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {testimonials.map((testimonial) => (
              <div key={testimonial.id} className="bg-muted p-10 rounded-none border border-border relative group hover:scale-[1.02] transition-all duration-500">
                <div className="flex items-center gap-4 mb-8">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-16 h-16 rounded-none object-cover ring-4 ring-background"
                  />
                  <div>
                    <h4 className="font-black text-lg uppercase tracking-tight italic">{testimonial.name}</h4>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{testimonial.role}</p>
                  </div>
                </div>
                <div className="flex text-foreground mb-6 gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-muted-foreground" />
                  ))}
                </div>
                <p className="text-muted-foreground font-medium leading-relaxed italic">"{testimonial.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Global CTA */}
      <section className="py-40 relative overflow-hidden bg-accent">
        <div className="absolute inset-0 z-0">
          <img
            src={YEVBI_CTA_VISUAL}
            alt="Adventure awaits"
            className="w-full h-full object-cover scale-105 brightness-75 opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/50 to-transparent" />
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-5xl md:text-8xl font-black text-foreground mb-10 uppercase italic tracking-tighter leading-none">
            Your destination<br />
            <span className="text-foreground">is always online</span>
          </h2>
          <p className="text-xl md:text-2xl text-foreground/50 font-medium mb-16 max-w-2xl mx-auto italic leading-relaxed">
            Download your digital freedom and explore the world without connectivity boundaries.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            <Button size="lg" onClick={handleBrowsePackages} className="h-20 px-14 rounded-none font-black text-2xl active:scale-95 transition-transform bg-primary text-primary-foreground hover:bg-muted hover:text-foreground">
              Find My eSIM
            </Button>
            <Button variant="outline" className="h-20 px-14 rounded-none font-black text-2xl active:scale-95 transition-transform bg-transparent border border-border text-foreground hover:bg-muted hover:text-foreground">
              <Mail className="w-6 h-6 mr-3" /> Get Support
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ChevronDownSmall({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4", className)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

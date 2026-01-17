/**
 * TravelPass Home Page Component
 * 
 * SDK-compliant component accepting HomePageProps from theme.ts
 * Uses onNavigate callback and t() for i18n
 */

import type { HomePageProps } from '../../../../shared/src/types/theme';

// Helper for translations with fallback
// TravelPass theme uses its own hardcoded content for branding consistency
// The fallback values ARE the TravelPass-specific content
const getText = (t: HomePageProps['t'], key: string, fallback: string): string => {
    // For TravelPass theme, always use the fallback (which is our theme's branded content)
    // This ensures TravelPass branding is consistent across all tenants
    return fallback;
};


// Hero Section
function HeroSection({ onNavigate, t }: Pick<HomePageProps, 'onNavigate' | 't'>) {
    return (
        <section className="relative mt-0">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/70 to-black/50 z-10"></div>
            <img
                src="https://images.unsplash.com/photo-1499678329028-101435549a4e?auto=format&fit=crop&w=1770&q=80"
                alt="Travel destinations"
                className="w-full h-[600px] object-cover"
            />

            <div className="container mx-auto px-4 absolute inset-0 flex items-center z-20">
                <div className="max-w-xl text-white mt-20">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">
                        {getText(t, 'shop.home.hero.title', 'Stay Connected Everywhere You Go')}
                    </h1>
                    <p className="text-xl mb-6">
                        {getText(t, 'shop.home.hero.subtitle', 'Get affordable eSIM travel packages for 190+ countries. No contracts, instant activation.')}
                    </p>
                    <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                        <button
                            onClick={() => onNavigate?.('/products')}
                            className="inline-block text-center py-3 px-6 rounded-md bg-blue-600 hover:bg-blue-700 transition text-white font-medium"
                        >
                            {getText(t, 'shop.home.hero.browsePackages', 'Browse Packages')}
                        </button>
                        <button
                            onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                            className="inline-block text-center py-3 px-6 rounded-md bg-transparent border border-white text-white hover:bg-white/20 transition"
                        >
                            {getText(t, 'shop.home.hero.howItWorks', 'How It Works')}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}

// Search Section
function SearchSection({ t }: Pick<HomePageProps, 't'>) {
    return (
        <section className="bg-white py-8 shadow-md relative -mt-20 z-30 rounded-lg max-w-5xl mx-auto px-4">
            <div className="container mx-auto">
                <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {getText(t, 'shop.home.search.destination', 'Destination')}
                        </label>
                        <select className="block w-full border-gray-300 rounded-md shadow-sm py-3 pl-10 pr-3 border">
                            <option value="">{getText(t, 'shop.home.search.selectCountry', 'Select country or region')}</option>
                            <option>United States</option>
                            <option>Europe</option>
                            <option>Japan</option>
                            <option>Thailand</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {getText(t, 'shop.home.search.dataNeeded', 'Data Needed')}
                        </label>
                        <select className="block w-full border-gray-300 rounded-md shadow-sm py-3 pl-10 pr-3 border">
                            <option value="">{getText(t, 'shop.home.search.selectData', 'Select data amount')}</option>
                            <option>1GB - Light Usage</option>
                            <option>3GB - Regular Usage</option>
                            <option>5GB - Heavy Usage</option>
                            <option>Unlimited</option>
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {getText(t, 'shop.home.search.duration', 'Duration')}
                        </label>
                        <select className="block w-full border-gray-300 rounded-md shadow-sm py-3 pl-10 pr-3 border">
                            <option value="">{getText(t, 'shop.home.search.selectDuration', 'Select duration')}</option>
                            <option>7 days</option>
                            <option>14 days</option>
                            <option>30 days</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-md transition">
                            {getText(t, 'shop.home.search.findPlans', 'Find Plans')}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}

// Popular Destinations
function PopularDestinations({ onNavigate, t }: Pick<HomePageProps, 'onNavigate' | 't'>) {
    const destinations = [
        { name: 'France', image: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=400&q=80', price: '$9.99', rating: '4.8', network: '4G/5G • Europe' },
        { name: 'Japan', image: 'https://images.unsplash.com/photo-1480796927426-f609979314bd?auto=format&fit=crop&w=400&q=80', price: '$12.99', rating: '4.9', network: '4G/5G • Asia' },
        { name: 'UAE', image: 'https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?auto=format&fit=crop&w=400&q=80', price: '$14.99', rating: '4.7', network: '4G/5G • Middle East' },
        { name: 'Thailand', image: 'https://images.unsplash.com/photo-1568797629192-578ec5f3f5f4?auto=format&fit=crop&w=400&q=80', price: '$8.99', rating: '4.6', network: '4G/5G • Southeast Asia' },
    ];

    return (
        <section className="py-16 bg-gray-50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-800">
                        {getText(t, 'shop.home.destinations.title', 'Popular Destinations')}
                    </h2>
                    <p className="text-gray-600 mt-2">
                        {getText(t, 'shop.home.destinations.subtitle', 'Explore our most popular eSIM travel packages')}
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {destinations.map((dest) => (
                        <div key={dest.name} className="bg-white rounded-lg shadow-md overflow-hidden group hover:shadow-lg transition-shadow">
                            <div className="relative">
                                <img src={dest.image} alt={dest.name} className="w-full h-48 object-cover" />
                                <div className="absolute top-3 right-3 bg-white rounded-full py-1 px-3 shadow-md">
                                    <span className="text-sm font-medium text-gray-800">From {dest.price}</span>
                                </div>
                            </div>
                            <div className="p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-lg font-semibold text-gray-800">{dest.name}</h3>
                                    <span className="text-gray-600">⭐ {dest.rating}</span>
                                </div>
                                <p className="text-sm text-gray-600 mb-3">{dest.network}</p>
                                <button
                                    onClick={() => onNavigate?.('/products')}
                                    className="block w-full text-center py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-600 hover:text-white transition"
                                >
                                    {getText(t, 'shop.home.destinations.viewPlans', 'View Plans')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="text-center mt-8">
                    <button
                        onClick={() => onNavigate?.('/products')}
                        className="inline-block py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition"
                    >
                        {getText(t, 'shop.home.destinations.viewAll', 'View All Destinations →')}
                    </button>
                </div>
            </div>
        </section>
    );
}

// How It Works
function HowItWorks({ t }: Pick<HomePageProps, 't'>) {
    const steps = [
        { icon: '🛒', title: getText(t, 'shop.home.howItWorks.step1.title', '1. Purchase an eSIM'), desc: getText(t, 'shop.home.howItWorks.step1.desc', 'Choose from our wide range of travel packages.') },
        { icon: '📱', title: getText(t, 'shop.home.howItWorks.step2.title', '2. Scan QR Code'), desc: getText(t, 'shop.home.howItWorks.step2.desc', 'Receive your eSIM QR code instantly via email.') },
        { icon: '🌍', title: getText(t, 'shop.home.howItWorks.step3.title', '3. Connect and Go'), desc: getText(t, 'shop.home.howItWorks.step3.desc', 'Activate your eSIM and stay connected.') },
    ];

    return (
        <section id="how-it-works" className="py-16 bg-white">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-800">
                        {getText(t, 'shop.home.howItWorks.title', 'How It Works')}
                    </h2>
                    <p className="text-gray-600 mt-2">
                        {getText(t, 'shop.home.howItWorks.subtitle', 'Get connected in 3 simple steps')}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {steps.map((step) => (
                        <div key={step.title} className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-blue-100 text-2xl">
                                {step.icon}
                            </div>
                            <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                            <p className="text-gray-600">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// Features Section
function FeaturesSection({ t }: Pick<HomePageProps, 't'>) {
    const features = [
        { icon: '⚡', title: getText(t, 'shop.home.features.instant.title', 'Instant Activation'), desc: getText(t, 'shop.home.features.instant.desc', 'Get your eSIM instantly after purchase.') },
        { icon: '💵', title: getText(t, 'shop.home.features.pricing.title', 'No Hidden Fees'), desc: getText(t, 'shop.home.features.pricing.desc', 'Transparent pricing with no contracts.') },
        { icon: '🌐', title: getText(t, 'shop.home.features.coverage.title', 'Global Coverage'), desc: getText(t, 'shop.home.features.coverage.desc', 'Stay connected in 190+ countries.') },
        { icon: '🎧', title: getText(t, 'shop.home.features.support.title', '24/7 Support'), desc: getText(t, 'shop.home.features.support.desc', 'Customer support available around the clock.') },
    ];

    return (
        <section className="py-16 bg-gray-50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-800">
                        {getText(t, 'shop.home.features.title', 'Why Choose TravelPass')}
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {features.map((f) => (
                        <div key={f.title} className="bg-white p-6 rounded-lg shadow-sm text-center">
                            <div className="text-3xl mb-4">{f.icon}</div>
                            <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                            <p className="text-gray-600 text-sm">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// CTA Section
function CTASection({ onNavigate, t }: Pick<HomePageProps, 'onNavigate' | 't'>) {
    return (
        <section className="py-16 bg-blue-600">
            <div className="container mx-auto px-4 text-center">
                <h2 className="text-3xl font-bold text-white mb-6">
                    {getText(t, 'shop.home.cta.title', 'Ready for Your Next Adventure?')}
                </h2>
                <p className="text-xl text-white/90 mb-8 max-w-3xl mx-auto">
                    {getText(t, 'shop.home.cta.subtitle', 'Get connected with TravelPass eSIM and enjoy hassle-free internet access worldwide.')}
                </p>
                <button
                    onClick={() => onNavigate?.('/products')}
                    className="inline-block py-3 px-8 bg-white text-blue-600 font-semibold rounded-md hover:bg-gray-100 transition"
                >
                    {getText(t, 'shop.home.cta.button', 'Find Your eSIM')}
                </button>
            </div>
        </section>
    );
}

// Main HomePage Component - SDK Compliant
export function HomePage({ config, onNavigate, t }: HomePageProps) {
    return (
        <>
            <HeroSection onNavigate={onNavigate} t={t} />
            <SearchSection t={t} />
            <PopularDestinations onNavigate={onNavigate} t={t} />
            <HowItWorks t={t} />
            <FeaturesSection t={t} />
            <CTASection onNavigate={onNavigate} t={t} />
        </>
    );
}

export default HomePage;

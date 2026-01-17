'use client';

import Link from 'next/link';

export function HelpPage() {
    const faqCategories = [
        { name: 'Getting Started', icon: '🚀', count: 5 },
        { name: 'Account & Billing', icon: '💳', count: 8 },
        { name: 'eSIM Activation', icon: '📱', count: 12 },
        { name: 'Troubleshooting', icon: '🔧', count: 10 },
        { name: 'Refunds & Returns', icon: '↩️', count: 4 },
    ];

    const popularQuestions = [
        { question: 'How do I activate my eSIM?', answer: 'After purchase, you will receive a QR code via email. Simply scan it with your smartphone camera to install the eSIM.' },
        { question: 'Which devices support eSIM?', answer: 'Most modern smartphones support eSIM, including iPhone XS and later, Samsung Galaxy S20 and later, and Google Pixel 3 and later.' },
        { question: 'Can I use eSIM with my existing SIM card?', answer: 'Yes! Most eSIM-compatible devices support Dual SIM, allowing you to use both your regular SIM and eSIM simultaneously.' },
        { question: 'What happens when my data runs out?', answer: 'You can purchase an additional data package through our app or website. Your eSIM will remain active.' },
    ];

    return (
        <>
            {/* Page Header */}
            <section className="bg-blue-600 py-12 mt-16">
                <div className="container mx-auto px-4">
                    <h1 className="text-3xl font-bold text-white text-center">Help Center</h1>
                    <p className="text-center text-white/90 mt-2">Find answers to your questions</p>

                    {/* Search */}
                    <div className="max-w-xl mx-auto mt-8">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search for help..."
                                className="w-full py-3 px-4 pl-12 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-12 bg-gray-50 min-h-[60vh]">
                <div className="container mx-auto px-4">
                    {/* FAQ Categories */}
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold text-center mb-8">Browse by Category</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {faqCategories.map((cat) => (
                                <div key={cat.name} className="bg-white p-6 rounded-lg shadow-sm text-center hover:shadow-md transition cursor-pointer">
                                    <div className="text-3xl mb-2">{cat.icon}</div>
                                    <h3 className="font-semibold text-gray-800">{cat.name}</h3>
                                    <p className="text-sm text-gray-500">{cat.count} articles</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Popular Questions */}
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-2xl font-bold text-center mb-8">Popular Questions</h2>
                        <div className="space-y-4">
                            {popularQuestions.map((faq, index) => (
                                <div key={index} className="bg-white p-6 rounded-lg shadow-sm">
                                    <h3 className="font-semibold text-gray-800 mb-2">{faq.question}</h3>
                                    <p className="text-gray-600">{faq.answer}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Contact Section */}
                    <div className="mt-12 text-center">
                        <h2 className="text-xl font-semibold mb-4">Still need help?</h2>
                        <p className="text-gray-600 mb-6">Our support team is available 24/7 to assist you</p>
                        <div className="flex justify-center gap-4">
                            <Link href="/contact" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium transition">
                                Contact Support
                            </Link>
                            <a href="#" className="border border-blue-600 text-blue-600 hover:bg-blue-50 px-6 py-3 rounded-md font-medium transition">
                                Live Chat
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

export default HelpPage;

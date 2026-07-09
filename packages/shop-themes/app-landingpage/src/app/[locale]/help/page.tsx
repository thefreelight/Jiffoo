'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const faqs = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'What is an eSIM?',
        a: 'An eSIM (embedded SIM) is a digital SIM that allows you to activate a cellular plan without having to use a physical SIM card. Its built into your device and can be programmed to connect to different carriers.',
      },
      {
        q: 'How do I know if my device supports eSIM?',
        a: 'Most modern smartphones support eSIM, including iPhone XR and newer, Samsung Galaxy S20 and newer, and Google Pixel 3 and newer. Check your device settings under Cellular/Mobile Data to see if eSIM is available.',
      },
      {
        q: 'How do I install my eSIM?',
        a: 'After purchase, you will receive a QR code via email. Simply scan this QR code with your device camera or go to Settings > Cellular > Add Cellular Plan and scan the code.',
      },
    ],
  },
  {
    category: 'Orders & Payments',
    questions: [
      {
        q: 'When will I receive my eSIM?',
        a: 'Your eSIM QR code will be delivered instantly via email after your payment is confirmed. You can also access it from your account dashboard.',
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit cards (Visa, Mastercard, American Express), PayPal, Apple Pay, and Google Pay.',
      },
      {
        q: 'Can I get a refund?',
        a: 'Yes, we offer a 7-day refund policy for eSIMs that have not been activated. Once activated, the eSIM cannot be refunded.',
      },
    ],
  },
  {
    category: 'Usage & Coverage',
    questions: [
      {
        q: 'When does my eSIM validity start?',
        a: 'Your eSIM validity period starts when you first connect to a network at your destination, not when you install it. This allows you to install it before your trip.',
      },
      {
        q: 'What happens if I run out of data?',
        a: 'You can easily top up your data through our website or app. Simply log in to your account and select the top-up option for your active eSIM.',
      },
      {
        q: 'Can I use my eSIM for calls and texts?',
        a: 'Most of our eSIM plans are data-only. However, you can use apps like WhatsApp, Skype, or FaceTime for calls and messaging over data.',
      },
    ],
  },
];

export default function HelpPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const toggleQuestion = (id: string) => {
    setOpenQuestion(openQuestion === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-gray-100 py-2">
        <div className="container mx-auto px-4">
          <nav className="flex text-sm">
            <button onClick={() => router.push(`/${locale}`)} className="text-gray-500 hover:text-blue-600">Home</button>
            <span className="mx-2 text-gray-500">/</span>
            <span className="text-gray-800 font-medium">Help Center</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-blue-600 py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold text-white mb-4">How can we help you?</h1>
          <p className="text-white/90 mb-8 max-w-2xl mx-auto">
            Find answers to common questions about our eSIM services, installation, and usage.
          </p>
          <div className="max-w-xl mx-auto relative">
            <input
              type="text"
              placeholder="Search for help..."
              className="w-full px-4 py-3 pl-10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <button className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition text-left">
              <i className="fas fa-book text-blue-600 text-2xl mb-4"></i>
              <h3 className="font-semibold text-gray-800 mb-2">Getting Started Guide</h3>
              <p className="text-gray-600 text-sm">Learn how to purchase and install your first eSIM</p>
            </button>

            <button
              onClick={() => router.push(`/${locale}/contact`)}
              className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition text-left"
            >
              <i className="fas fa-headset text-blue-600 text-2xl mb-4"></i>
              <h3 className="font-semibold text-gray-800 mb-2">Contact Support</h3>
              <p className="text-gray-600 text-sm">Get help from our 24/7 support team</p>
            </button>

            <button className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition text-left">
              <i className="fas fa-video text-blue-600 text-2xl mb-4"></i>
              <h3 className="font-semibold text-gray-800 mb-2">Video Tutorials</h3>
              <p className="text-gray-600 text-sm">Watch step-by-step installation guides</p>
            </button>
          </div>

          {/* FAQ */}
          <h2 className="text-2xl font-bold text-gray-800 mb-8">Frequently Asked Questions</h2>

          <div className="space-y-8">
            {faqs.map((category, categoryIndex) => (
              <div key={categoryIndex}>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">{category.category}</h3>
                <div className="space-y-3">
                  {category.questions.map((item, questionIndex) => {
                    const id = `${categoryIndex}-${questionIndex}`;
                    return (
                      <div key={id} className="bg-white rounded-lg shadow-sm">
                        <button
                          onClick={() => toggleQuestion(id)}
                          className="w-full px-6 py-4 text-left flex items-center justify-between"
                        >
                          <span className="font-medium text-gray-800">{item.q}</span>
                          <i className={`fas fa-chevron-${openQuestion === id ? 'up' : 'down'} text-gray-400`}></i>
                        </button>
                        {openQuestion === id && (
                          <div className="px-6 pb-4">
                            <p className="text-gray-600">{item.a}</p>
                          </div>
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

      {/* Still Need Help */}
      <section className="py-12 bg-gray-100">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Still need help?</h2>
          <p className="text-gray-600 mb-6">Our support team is available 24/7 to assist you</p>
          <button
            onClick={() => router.push(`/${locale}/contact`)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-md font-medium transition"
          >
            Contact Us
          </button>
        </div>
      </section>
    </div>
  );
}

'use client';

import { useParams, useRouter } from 'next/navigation';

export default function PrivacyPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-gray-100 py-2">
        <div className="container mx-auto px-4">
          <nav className="flex text-sm">
            <button onClick={() => router.push(`/${locale}`)} className="text-gray-500 hover:text-blue-600">Home</button>
            <span className="mx-2 text-gray-500">/</span>
            <span className="text-gray-800 font-medium">Privacy Policy</span>
          </nav>
        </div>
      </div>

      {/* Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Privacy Policy</h1>
            <p className="text-gray-600 mb-8">Last updated: January 1, 2024</p>

            <div className="prose prose-gray max-w-none">
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">1. Information We Collect</h2>
              <p className="text-gray-600 mb-4">
                We collect information you provide directly to us, such as when you create an account, make a purchase,
                or contact us for support. This information may include:
              </p>
              <ul className="list-disc pl-6 text-gray-600 mb-4 space-y-2">
                <li>Name and email address</li>
                <li>Payment information</li>
                <li>Device information</li>
                <li>Travel destination and dates</li>
                <li>Communication preferences</li>
              </ul>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">2. How We Use Your Information</h2>
              <p className="text-gray-600 mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 text-gray-600 mb-4 space-y-2">
                <li>Process and deliver your eSIM orders</li>
                <li>Provide customer support</li>
                <li>Send you important updates about your service</li>
                <li>Improve our products and services</li>
                <li>Comply with legal obligations</li>
              </ul>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">3. Information Sharing</h2>
              <p className="text-gray-600 mb-4">
                We do not sell, trade, or otherwise transfer your personal information to third parties without your consent,
                except as necessary to provide our services (such as payment processing) or as required by law.
              </p>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">4. Data Security</h2>
              <p className="text-gray-600 mb-4">
                We implement appropriate technical and organizational measures to protect your personal information against
                unauthorized access, alteration, disclosure, or destruction. All payment transactions are encrypted using SSL technology.
              </p>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">5. Your Rights</h2>
              <p className="text-gray-600 mb-4">
                You have the right to:
              </p>
              <ul className="list-disc pl-6 text-gray-600 mb-4 space-y-2">
                <li>Access your personal information</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to processing of your data</li>
                <li>Data portability</li>
              </ul>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">6. Cookies</h2>
              <p className="text-gray-600 mb-4">
                We use cookies and similar technologies to enhance your experience, analyze site usage, and assist in our
                marketing efforts. You can control cookie settings through your browser preferences.
              </p>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">7. Changes to This Policy</h2>
              <p className="text-gray-600 mb-4">
                We may update this privacy policy from time to time. We will notify you of any changes by posting the new
                policy on this page and updating the "Last updated" date.
              </p>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">8. Contact Us</h2>
              <p className="text-gray-600 mb-4">
                If you have any questions about this Privacy Policy, please contact us at:
              </p>
              <p className="text-gray-600 mb-4">
                Email: privacy@travelpass.com<br />
                Or use our <button onClick={() => router.push(`/${locale}/contact`)} className="text-blue-600 hover:underline">contact form</button>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

'use client';

import { useParams, useRouter } from 'next/navigation';

export default function TermsPage() {
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
            <span className="text-gray-800 font-medium">Terms of Service</span>
          </nav>
        </div>
      </div>

      {/* Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Terms of Service</h1>
            <p className="text-gray-600 mb-8">Last updated: January 1, 2024</p>

            <div className="prose prose-gray max-w-none">
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-600 mb-4">
                By accessing or using TravelPass services, you agree to be bound by these Terms of Service. If you do not
                agree to these terms, please do not use our services.
              </p>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">2. eSIM Services</h2>
              <p className="text-gray-600 mb-4">
                TravelPass provides digital eSIM services that allow you to access mobile data in various countries.
                Our services are subject to the following conditions:
              </p>
              <ul className="list-disc pl-6 text-gray-600 mb-4 space-y-2">
                <li>eSIMs are digital products delivered electronically</li>
                <li>Data plans are valid for the specified period starting from first network connection</li>
                <li>Coverage and speeds may vary depending on location and network conditions</li>
                <li>You are responsible for ensuring your device is eSIM compatible</li>
              </ul>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">3. Account Registration</h2>
              <p className="text-gray-600 mb-4">
                To purchase our services, you must create an account and provide accurate information. You are responsible
                for maintaining the confidentiality of your account credentials.
              </p>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">4. Payment and Pricing</h2>
              <p className="text-gray-600 mb-4">
                All prices are displayed in USD unless otherwise specified. Payment is required at the time of purchase.
                We accept major credit cards, PayPal, and other payment methods as indicated on our website.
              </p>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">5. Refund Policy</h2>
              <p className="text-gray-600 mb-4">
                We offer refunds under the following conditions:
              </p>
              <ul className="list-disc pl-6 text-gray-600 mb-4 space-y-2">
                <li>Full refund within 7 days for unused (not activated) eSIMs</li>
                <li>No refund for activated eSIMs</li>
                <li>Refund requests must be submitted through our support channels</li>
                <li>Processing time for refunds is 5-10 business days</li>
              </ul>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">6. Acceptable Use</h2>
              <p className="text-gray-600 mb-4">
                You agree not to use our services for:
              </p>
              <ul className="list-disc pl-6 text-gray-600 mb-4 space-y-2">
                <li>Any illegal activities</li>
                <li>Excessive data usage that impacts network quality for others</li>
                <li>Reselling or redistributing our services without authorization</li>
                <li>Any activity that violates the policies of our partner networks</li>
              </ul>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">7. Limitation of Liability</h2>
              <p className="text-gray-600 mb-4">
                TravelPass shall not be liable for any indirect, incidental, special, consequential, or punitive damages
                resulting from your use of our services. Our total liability shall not exceed the amount paid for the
                specific service in question.
              </p>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">8. Service Availability</h2>
              <p className="text-gray-600 mb-4">
                While we strive to provide uninterrupted service, we do not guarantee that our services will be available
                at all times. Network conditions, maintenance, and other factors may affect service availability.
              </p>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">9. Changes to Terms</h2>
              <p className="text-gray-600 mb-4">
                We reserve the right to modify these terms at any time. Changes will be posted on this page with an updated
                effective date. Continued use of our services after changes constitute acceptance of the new terms.
              </p>

              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">10. Contact</h2>
              <p className="text-gray-600 mb-4">
                For questions about these Terms of Service, please contact us at:
              </p>
              <p className="text-gray-600 mb-4">
                Email: legal@travelpass.com<br />
                Or use our <button onClick={() => router.push(`/${locale}/contact`)} className="text-blue-600 hover:underline">contact form</button>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
